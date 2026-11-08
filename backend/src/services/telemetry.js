const { pool } = require('../config/db');
const { env } = require('../config/env');
const { deviceByCode, deviceById } = require('./store');
const { mapTelemetry } = require('../utils/data');
const { broadcast } = require('./realtime');
const { evaluateRules } = require('./rules');
const { deviceStates } = require('../utils/firmwareProtocol');
const { updateActuatorStates } = require('./actuators');
const { syncThresholds } = require('./configSync');

const lastThresholdSync = new Map();

async function updateHeartbeat(device) {
  const result = await pool.query(
    `UPDATE nodes SET last_heartbeat=NOW(), lifecycle_status='ACTIVE'
     WHERE device_id=$1 AND lifecycle_status IN ('ACTIVE','OFFLINE') RETURNING device_id`,
    [device.device_id]
  );
  if (!result.rowCount) return;
  const updated = await deviceById(device.device_id);
  broadcast('device_status', {
    device_id: updated.device_id,
    online: updated.online,
    last_heartbeat: updated.last_heartbeat,
    lifecycle_status: updated.lifecycle_status
  });
}

async function receiveHeartbeat(code) {
  const device = await deviceByCode(code);
  if (!device || !['ACTIVE', 'OFFLINE'].includes(device.lifecycle_status)) return;
  await updateHeartbeat(device);
  if (env.syncThresholdsOnHeartbeat && code.endsWith('_ENV') && Date.now() - (lastThresholdSync.get(code) || 0) > 60000) {
    try {
      if (await syncThresholds(device.device_id, code)) lastThresholdSync.set(code, Date.now());
    } catch (error) {
      console.error('Không đồng bộ được ngưỡng với Node 1:', error.message);
    }
  }
}

async function receiveTelemetry(code, payload) {
  const device = await deviceByCode(code);
  if (!device || !['ACTIVE', 'OFFLINE'].includes(device.lifecycle_status)) return;
  const data = mapTelemetry(payload);
  if (!data) return;
  if (code.endsWith('_ENV') && data.temperature === null && data.humidity === null && data.smoke_gas_level === null) return;
  if (code.endsWith('_SEC') && data.door_status === null && data.motion_detected === null) return;
  const previousResult = await pool.query(
    'SELECT temperature,humidity,smoke_gas_level,door_status,motion_detected FROM telemetry WHERE device_id=$1 ORDER BY recorded_at DESC,telemetry_id DESC LIMIT 1',
    [device.device_id]
  );
  const result = await pool.query(
    `INSERT INTO telemetry(device_id,temperature,humidity,smoke_gas_level,door_status,motion_detected)
     VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [device.device_id, data.temperature, data.humidity, data.smoke_gas_level, data.door_status, data.motion_detected]
  );
  await updateHeartbeat(device);
  await updateActuatorStates(device.device_id, code, deviceStates(code, payload));
  const reading = { ...result.rows[0], device_code: code };
  broadcast('telemetry', reading);
  const configs = await pool.query('SELECT * FROM device_configs WHERE device_id=$1', [device.device_id]);
  if (configs.rowCount) {
    await evaluateRules(device, configs.rows[0], data, previousResult.rows[0] || null);
  }
  return reading;
}

module.exports = { receiveHeartbeat, receiveTelemetry };
