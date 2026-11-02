const express = require('express');
const crypto = require('node:crypto');
const { pool, transaction } = require('../config/db');
const { verifyToken, authorizeRoles } = require('../middlewares/auth');
const { HttpError, requiredString, positiveId, optionalNumber, boolValue, enumValue } = require('../utils/http');
const { env } = require('../config/env');
const { deviceSelect, deviceById } = require('../services/store');
const { deviceView, guardArmed } = require('../utils/data');
const { audit } = require('../services/audit');
const { broadcast } = require('../services/realtime');
const { syncThresholds, syncGuardMode } = require('../services/configSync');

const router = express.Router();
router.use(verifyToken);

function publicDeviceEvent(device) {
  broadcast('device_status', {
    device_id: device.device_id,
    online: device.online,
    last_heartbeat: device.last_heartbeat,
    lifecycle_status: device.lifecycle_status
  });
}

function tokenPair() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: crypto.createHash('sha256').update(token).digest('hex'), suffix: token.slice(-4) };
}

router.get('/', async (req, res) => {
  const result = await pool.query(`${deviceSelect} ORDER BY n.device_id ASC`);
  res.json(result.rows.map(deviceView));
});

router.post('/', authorizeRoles('ADMIN'), async (req, res) => {
  const body = req.body || {};
  const name = requiredString(body.device_name, 'Tên thiết bị');
  const code = requiredString(body.device_code, 'Mã thiết bị', 50);
  if (!/^NODE[0-9]+_(ENV|SEC)$/.test(code)) throw new HttpError(400, 'Mã thiết bị cần có dạng NODE1_ENV hoặc NODE2_SEC.');
  const mac = requiredString(body.mac_address, 'Địa chỉ MAC', 17).toUpperCase();
  if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac)) throw new HttpError(400, 'Địa chỉ MAC không hợp lệ.');
  const warehouse = body.warehouse_id == null ? null : positiveId(body.warehouse_id, 'Mã kho');
  const assigned = body.assigned_user_id == null ? null : positiveId(body.assigned_user_id, 'Mã người phụ trách');
  const token = tokenPair();
  const id = await transaction(async db => {
    const created = await db.query(
      `INSERT INTO nodes(device_code,device_name,warehouse_id,assigned_user_id,mac_address,auth_token_hash,auth_token_suffix)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING device_id`,
      [code, name, warehouse, assigned, mac, token.hash, token.suffix]
    );
    const deviceId = created.rows[0].device_id;
    await db.query('INSERT INTO device_configs(device_id) VALUES($1)', [deviceId]);
    const sensorTypes = code.endsWith('_ENV') ? [['DHT22_TEMPERATURE', '°C'], ['DHT22_HUMIDITY', '%'], ['MQ2_SMOKE', 'ppm']] : [['MC38_DOOR', null], ['PIR_MOTION', null]];
    const actuatorTypes = code.endsWith('_ENV') ? ['FAN'] : ['BUZZER', 'LED_RED'];
    for (const [type, unit] of sensorTypes) await db.query('INSERT INTO sensors(device_id,sensor_type,unit) VALUES($1,$2,$3)', [deviceId, type, unit]);
    for (const type of actuatorTypes) await db.query('INSERT INTO actuators(device_id,actuator_type) VALUES($1,$2)', [deviceId, type]);
    await audit('REGISTER_DEVICE', req.user.user_id, { device_code: code, device_id: deviceId }, req.ip, db);
    return deviceId;
  });
  res.status(201).json({ device: await deviceById(id), auth_token: token.token });
});

router.get('/:id', async (req, res) => res.json(await deviceById(positiveId(req.params.id))));

router.post('/:id/activate', authorizeRoles('ADMIN'), async (req, res) => {
  const id = positiveId(req.params.id);
  await transaction(async db => {
    const result = await db.query(
      `UPDATE nodes SET lifecycle_status='ACTIVE',activated_at=NOW() WHERE device_id=$1
       AND lifecycle_status='REGISTERED' AND auth_token_hash IS NOT NULL RETURNING device_id`,
      [id]
    );
    if (!result.rowCount) throw new HttpError(409, 'Thiết bị không ở trạng thái chờ kích hoạt hoặc thiếu token.');
    await audit('ACTIVATE_DEVICE', req.user.user_id, { device_id: id }, req.ip, db);
  });
  const device = await deviceById(id);
  publicDeviceEvent(device);
  res.json(device);
});

router.patch('/:id/lifecycle', authorizeRoles('ADMIN'), async (req, res) => {
  const id = positiveId(req.params.id);
  const status = enumValue(req.body?.status, ['ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED'], 'Trạng thái vòng đời');
  await transaction(async db => {
    const existing = await db.query('SELECT lifecycle_status FROM nodes WHERE device_id=$1 FOR UPDATE', [id]);
    if (!existing.rowCount) throw new HttpError(404, 'Không tìm thấy thiết bị.');
    const before = existing.rows[0].lifecycle_status;
    if (before === 'DECOMMISSIONED') throw new HttpError(409, 'Thiết bị đã thu hồi không thể kích hoạt lại.');
    if (before === 'REGISTERED') throw new HttpError(409, 'Hãy kích hoạt thiết bị trước khi thay đổi vòng đời.');
    await db.query(
      `UPDATE nodes SET lifecycle_status=$2::text,
       auth_token_hash=CASE WHEN $2::text='DECOMMISSIONED' THEN NULL ELSE auth_token_hash END,
       auth_token_suffix=CASE WHEN $2::text='DECOMMISSIONED' THEN NULL ELSE auth_token_suffix END,
       activated_at=CASE WHEN $2::text='ACTIVE' THEN NOW() ELSE activated_at END,
       last_heartbeat=CASE WHEN $2::text='ACTIVE' THEN NULL ELSE last_heartbeat END
       WHERE device_id=$1`,
      [id, status]
    );
    await audit(status === 'DECOMMISSIONED' ? 'DECOMMISSION' : 'UPDATE_LIFECYCLE', req.user.user_id, { device_id: id, from: before, to: status }, req.ip, db);
  });
  const device = await deviceById(id);
  publicDeviceEvent(device);
  res.json(device);
});

router.post('/:id/token', authorizeRoles('ADMIN'), async (req, res) => {
  const id = positiveId(req.params.id);
  const secret = tokenPair();
  await transaction(async db => {
    const result = await db.query(
      `UPDATE nodes SET auth_token_hash=$2,auth_token_suffix=$3
       WHERE device_id=$1 AND lifecycle_status!='DECOMMISSIONED' RETURNING device_id`,
      [id, secret.hash, secret.suffix]
    );
    if (!result.rowCount) throw new HttpError(404, 'Không tìm thấy thiết bị có thể cấp lại token.');
    await audit('ROTATE_DEVICE_TOKEN', req.user.user_id, { device_id: id }, req.ip, db);
  });
  res.json({ auth_token: secret.token });
});

router.get('/:id/config', async (req, res) => {
  const id = positiveId(req.params.id);
  const result = await pool.query('SELECT * FROM device_configs WHERE device_id=$1', [id]);
  if (!result.rowCount) throw new HttpError(404, 'Không tìm thấy cấu hình thiết bị.');
  res.json(result.rows[0]);
});

router.put('/:id/config', authorizeRoles('ADMIN', 'OPERATOR'), async (req, res) => {
  const id = positiveId(req.params.id);
  const body = req.body || {};
  const fields = ['temperature_threshold', 'humidity_threshold', 'smoke_gas_threshold', 'telemetry_interval', 'night_mode_enabled', 'curfew_start_hour', 'curfew_end_hour', 'guard_mode'];
  if (!fields.some(field => Object.hasOwn(body, field))) throw new HttpError(400, 'Chưa có cấu hình cần thay đổi.');
  const temperature = Object.hasOwn(body, 'temperature_threshold') ? optionalNumber(body.temperature_threshold, 'Ngưỡng nhiệt độ', 0, 125) : undefined;
  const humidity = Object.hasOwn(body, 'humidity_threshold') ? optionalNumber(body.humidity_threshold, 'Ngưỡng độ ẩm', 0, 100) : undefined;
  const smoke = Object.hasOwn(body, 'smoke_gas_threshold') ? optionalNumber(body.smoke_gas_threshold, 'Ngưỡng khói', 0, 100000) : undefined;
  const interval = Object.hasOwn(body, 'telemetry_interval') ? optionalNumber(body.telemetry_interval, 'Chu kỳ dữ liệu', 1, 3600) : undefined;
  if (interval !== undefined && (!Number.isInteger(interval) || interval === null)) throw new HttpError(400, 'Chu kỳ dữ liệu phải là số nguyên dương.');
  const night = Object.hasOwn(body, 'night_mode_enabled') ? boolValue(body.night_mode_enabled, 'Chế độ ban đêm') : undefined;
  const curfewStart = Object.hasOwn(body, 'curfew_start_hour') ? optionalNumber(body.curfew_start_hour, 'Giờ bắt đầu giới nghiêm', 0, 23) : undefined;
  const curfewEnd = Object.hasOwn(body, 'curfew_end_hour') ? optionalNumber(body.curfew_end_hour, 'Giờ kết thúc giới nghiêm', 0, 23) : undefined;
  const guard = Object.hasOwn(body, 'guard_mode') ? enumValue(body.guard_mode, ['AUTO', 'ON', 'OFF'], 'Chế độ cảnh giới') : undefined;
  for (const [value, label] of [[curfewStart, 'Giờ bắt đầu giới nghiêm'], [curfewEnd, 'Giờ kết thúc giới nghiêm']])
    if (value !== undefined && (!Number.isInteger(value) || value === null)) throw new HttpError(400, `${label} phải là số nguyên từ 0 đến 23.`);
  const updated = await transaction(async db => {
    const result = await db.query(
      `UPDATE device_configs SET temperature_threshold=CASE WHEN $2::boolean THEN $3 ELSE temperature_threshold END,
       humidity_threshold=CASE WHEN $4::boolean THEN $5 ELSE humidity_threshold END,
       smoke_gas_threshold=CASE WHEN $6::boolean THEN $7 ELSE smoke_gas_threshold END,
       telemetry_interval=COALESCE($8,telemetry_interval),
       night_mode_enabled=COALESCE($9,night_mode_enabled),
       curfew_start_hour=COALESCE($10,curfew_start_hour),
       curfew_end_hour=COALESCE($11,curfew_end_hour),
       guard_mode=COALESCE($12,guard_mode),updated_at=NOW()
       WHERE device_id=$1 RETURNING *`,
      [id, temperature !== undefined, temperature ?? null, humidity !== undefined, humidity ?? null, smoke !== undefined, smoke ?? null, interval ?? null, night ?? null, curfewStart ?? null, curfewEnd ?? null, guard ?? null]
    );
    if (!result.rowCount) throw new HttpError(404, 'Không tìm thấy cấu hình thiết bị.');
    await audit('UPDATE_CONFIG', req.user.user_id, { device_id: id, changes: body }, req.ip, db);
    return result.rows[0];
  });
  if (temperature !== undefined || humidity !== undefined || smoke !== undefined) {
    const device = await deviceById(id);
    void syncThresholds(id, device.device_code).catch(error => console.error('Không gửi được ngưỡng cấu hình tới thiết bị:', error.message));
  }
  if (curfewStart !== undefined || curfewEnd !== undefined || guard !== undefined || night !== undefined) {
    const device = await deviceById(id);
    if (device.device_code.endsWith('_SEC')) {
      const armed = guardArmed(updated, new Date(), env.nightTimezone, env.nightStartHour, env.nightEndHour);
      void syncGuardMode(id, device.device_code, armed).catch(error => console.error('Không gửi được chế độ cảnh giới tới thiết bị:', error.message));
    }
  }
  res.json(updated);
});

module.exports = router;
