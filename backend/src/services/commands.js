const { pool, transaction } = require('../config/db');
const { HttpError } = require('../utils/http');
const { audit } = require('./audit');
const { commandById, deviceById } = require('./store');
const { broadcast } = require('./realtime');
const { commandPayload, ackDetails, ackStates } = require('../utils/firmwareProtocol');
const { updateActuatorStates } = require('./actuators');
const mqtt = require('./mqtt');

const manualTypes = ['FAN_ON', 'FAN_OFF', 'FAN_AUTO', 'BUZZER_OFF'];
const automaticTypes = ['FAN_ON', 'FAN_OFF', 'BUZZER_ON'];

function checkCommand(device, type, automatic) {
  if (!device || device.lifecycle_status !== 'ACTIVE') throw new HttpError(409, 'Thiết bị chưa kích hoạt hoặc đang bị khóa.');
  if (!(automatic ? automaticTypes : manualTypes).includes(type)) throw new HttpError(400, 'Loại lệnh không được hỗ trợ.');
  if (type.startsWith('FAN_') && !device.device_code.endsWith('_ENV')) throw new HttpError(400, 'Chỉ có thể điều khiển quạt ở Node môi trường.');
  if (type.startsWith('BUZZER_') && !device.device_code.endsWith('_SEC')) throw new HttpError(400, 'Chỉ có thể điều khiển còi ở Node an ninh.');
  if (type !== 'FAN_AUTO' && !mqtt.isConnected()) throw new HttpError(503, 'MQTT Broker chưa kết nối.');
}

async function commandResult(id) {
  const command = await commandById(id);
  broadcast('command_status', command);
  return command;
}

async function setCommandStatus(id, status, reason = null) {
  const result = await pool.query(
    `UPDATE device_controls SET status=$2::text,
       published_at=CASE WHEN $2::text='SENT' THEN NOW() ELSE published_at END,
       acknowledged_at=CASE WHEN $2::text='ACKNOWLEDGED' THEN NOW() ELSE acknowledged_at END,
       failure_reason=$3
     WHERE command_id=$1 AND status IN ('PENDING','SENT') RETURNING command_id`,
    [id, status, reason]
  );
  if (result.rowCount) await commandResult(id);
  return result.rowCount > 0;
}

async function deliver(command, code) {
  try {
    if (command.command_type === 'FAN_AUTO') {
      await pool.query('UPDATE device_configs SET fan_mode=$2,updated_at=NOW() WHERE device_id=$1', [command.device_id, 'AUTO']);
      await setCommandStatus(command.command_id, 'ACKNOWLEDGED');
      return;
    }
    const payload = commandPayload(command);
    if (!payload) throw new Error('Firmware không hỗ trợ lệnh này.');
    await mqtt.publish(code, payload);
    await setCommandStatus(command.command_id, 'SENT');
  } catch (error) {
    await setCommandStatus(command.command_id, 'FAILED', error.message);
    console.error('Không gửi được lệnh MQTT:', error.message);
  }
}

async function createCommand({ deviceId, type, parameters = null, userId = null, ip = null, automatic = false }) {
  if (parameters !== null && (typeof parameters !== 'object' || Array.isArray(parameters))) throw new HttpError(400, 'Tham số lệnh không hợp lệ.');
  const device = await deviceById(deviceId);
  checkCommand(device, type, automatic);
  if (automatic) {
    const pending = await pool.query(
      `SELECT command_id FROM device_controls WHERE device_id=$1 AND command_type=$2
       AND status IN ('PENDING','SENT') AND sent_at > NOW() - INTERVAL '30 seconds' LIMIT 1`,
      [deviceId, type]
    );
    if (pending.rowCount) return commandById(pending.rows[0].command_id);
  }
  const saved = await transaction(async db => {
    const result = await db.query(
      `INSERT INTO device_controls(device_id,user_id,command_type,parameters)
       VALUES($1,$2,$3,$4) RETURNING command_id`,
      [deviceId, userId, type, parameters ? JSON.stringify(parameters) : null]
    );
    if (!automatic) await audit('MANUAL_CONTROL', userId, { device_id: deviceId, command_type: type, command_id: result.rows[0].command_id }, ip, db);
    return result.rows[0].command_id;
  });
  const command = await commandById(saved);
  broadcast('command_status', command);
  void deliver(command, device.device_code).catch(error => console.error('Lỗi xử lý lệnh:', error.message));
  return command;
}

async function processAck(code, payload) {
  const details = ackDetails(payload.status);
  if (!details) return;
  const deviceResult = await pool.query(
    `SELECT device_id FROM nodes WHERE device_code=$1 AND lifecycle_status IN ('ACTIVE','OFFLINE')`,
    [code]
  );
  if (!deviceResult.rowCount) return;
  const deviceId = deviceResult.rows[0].device_id;
  if (details.kind) {
    const compatible = code.endsWith('_ENV') ? details.kind === 'FAN' : code.endsWith('_SEC') && details.kind === 'ALARM';
    if (!compatible) return;
    await updateActuatorStates(deviceId, code, ackStates(code, payload.status));
  }

  let commandId = null;
  const rawId = payload.command_id;
  if (rawId !== undefined && rawId !== null) {
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id < 1) return;
    const match = await pool.query(
      `SELECT command_id,command_type FROM device_controls
       WHERE command_id=$1 AND device_id=$2 AND status IN ('PENDING','SENT')`,
      [id, deviceId]
    );
    if (!match.rowCount) return;
    if (details.type && match.rows[0].command_type !== details.type) return;
    commandId = id;
  } else if (details.type) {
    const candidates = await pool.query(
      `SELECT command_id FROM device_controls WHERE device_id=$1 AND command_type=$2
       AND status IN ('PENDING','SENT') AND sent_at > NOW() - INTERVAL '10 seconds'
       ORDER BY sent_at DESC,command_id DESC LIMIT 2`,
      [deviceId, details.type]
    );
    if (candidates.rowCount !== 1) return;
    commandId = candidates.rows[0].command_id;
  }
  if (commandId === null) return;
  const changed = await setCommandStatus(commandId, details.successful ? 'ACKNOWLEDGED' : 'FAILED', details.successful ? null : 'Thiết bị báo lệnh không thành công.');
  if (!changed || !details.successful) return;
  const result = await pool.query('SELECT command_type,user_id FROM device_controls WHERE command_id=$1', [commandId]);
  if (!result.rowCount) return;
  const { command_type: type, user_id: userId } = result.rows[0];
  if (userId !== null && ['FAN_ON', 'FAN_OFF'].includes(type)) {
    await pool.query('UPDATE device_configs SET fan_mode=$2,updated_at=NOW() WHERE device_id=$1', [deviceId, type === 'FAN_ON' ? 'ON' : 'OFF']);
  }
  if (!details.kind) {
    const states = { FAN_ON: [['FAN', true]], FAN_OFF: [['FAN', false]], BUZZER_ON: [['BUZZER', true], ['LED_RED', true]], BUZZER_OFF: [['BUZZER', false], ['LED_RED', false]] };
    if (states[type]) await updateActuatorStates(deviceId, code, states[type]);
  }
}

module.exports = { createCommand, processAck, setCommandStatus, manualTypes };
