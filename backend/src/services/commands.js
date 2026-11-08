const { pool, transaction } = require('../config/db');
const { HttpError } = require('../utils/http');
const { audit } = require('./audit');
const { commandById, deviceById } = require('./store');
const { broadcast } = require('./realtime');
const mqtt = require('./mqtt');

const manualTypes = ['FAN_ON', 'FAN_OFF', 'FAN_AUTO', 'BUZZER_OFF'];
const automaticTypes = ['FAN_ON', 'FAN_OFF', 'BUZZER_ON', 'LED_RED'];

function checkCommand(device, type, automatic) {
  if (!device || device.lifecycle_status !== 'ACTIVE') throw new HttpError(409, 'Thiết bị chưa kích hoạt hoặc đang bị khóa.');
  if (!(automatic ? automaticTypes : manualTypes).includes(type)) throw new HttpError(400, 'Loại lệnh không được hỗ trợ.');
  if (type.startsWith('FAN_') && !device.device_code.endsWith('_ENV')) throw new HttpError(400, 'Chỉ có thể điều khiển quạt ở Node môi trường.');
  if ((type.startsWith('BUZZER_') || type.startsWith('LED_')) && !device.device_code.endsWith('_SEC')) {
    throw new HttpError(400, 'Chỉ có thể điều khiển còi và đèn ở Node an ninh.');
  }
  if (!mqtt.isConnected()) throw new HttpError(503, 'MQTT Broker chưa kết nối.');
}

async function commandResult(id) {
  const command = await commandById(id);
  broadcast('command_status', command);
  return command;
}

async function setCommandStatus(id, status, reason = null) {
  const result = await pool.query(
    `UPDATE device_controls SET status=$2,
       published_at=CASE WHEN $2='SENT' THEN NOW() ELSE published_at END,
       acknowledged_at=CASE WHEN $2='ACKNOWLEDGED' THEN NOW() ELSE acknowledged_at END,
       failure_reason=$3
     WHERE command_id=$1 AND status IN ('PENDING','SENT') RETURNING command_id`,
    [id, status, reason]
  );
  if (result.rowCount) await commandResult(id);
  return result.rowCount > 0;
}

async function deliver(command, code) {
  try {
    await mqtt.publish(code, {
      command_id: command.command_id,
      command: command.command_type,
      command_type: command.command_type,
      params: command.parameters || {},
      parameters: command.parameters || {}
    });
    await setCommandStatus(command.command_id, 'SENT');
  } catch (error) {
    await setCommandStatus(command.command_id, 'FAILED', error.message);
    console.error('Không gửi được lệnh MQTT:', error.message);
  }
}

async function createCommand({ deviceId, type, parameters = null, userId = null, ip = null, automatic = false }) {
  if (parameters !== null && (typeof parameters !== 'object' || Array.isArray(parameters))) {
    throw new HttpError(400, 'Tham số lệnh không hợp lệ.');
  }
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
    if (!automatic) {
      await audit('MANUAL_CONTROL', userId, { device_id: deviceId, command_type: type, command_id: result.rows[0].command_id }, ip, db);
    }
    return result.rows[0].command_id;
  });
  const command = await commandById(saved);
  broadcast('command_status', command);
  void deliver(command, device.device_code).catch(error => console.error('Lỗi xử lý lệnh:', error.message));
  return command;
}

async function processAck(code, payload) {
  const commandId = Number(payload.command_id);
  if (!Number.isSafeInteger(commandId) || commandId < 1) return;
  const result = await pool.query(
    `SELECT c.command_id FROM device_controls c JOIN nodes n ON n.device_id=c.device_id
     WHERE c.command_id=$1 AND n.device_code=$2 AND c.status IN ('PENDING','SENT')`,
    [commandId, code]
  );
  if (!result.rowCount) return;
  const response = String(payload.status || '').toUpperCase();
  if (!['OK', 'ACK', 'ACKED', 'ACKNOWLEDGED', 'SUCCESS', 'DONE', 'FAILED', 'ERROR'].includes(response)) return;
  const ok = ['OK', 'ACK', 'ACKED', 'ACKNOWLEDGED', 'SUCCESS', 'DONE'].includes(response);
  await setCommandStatus(commandId, ok ? 'ACKNOWLEDGED' : 'FAILED', ok ? null : 'Thiết bị báo thực hiện lệnh không thành công.');
  if (ok) {
    const row = await pool.query('SELECT device_id,command_type FROM device_controls WHERE command_id=$1', [commandId]);
    const command = row.rows[0];
    const states = { FAN_ON: ['FAN', true], FAN_OFF: ['FAN', false], BUZZER_ON: ['BUZZER', true], BUZZER_OFF: ['BUZZER', false], LED_RED: ['LED_RED', true] };
    const state = states[command.command_type];
    if (state) {
      await pool.query(
        'UPDATE actuators SET state=$3,updated_at=NOW() WHERE device_id=$1 AND actuator_type=$2',
        [command.device_id, state[0], state[1]]
      );
    }
    if (['FAN_ON', 'FAN_OFF', 'FAN_AUTO'].includes(command.command_type) && row.rows[0]) {
      const source = await pool.query('SELECT user_id FROM device_controls WHERE command_id=$1', [commandId]);
      if (source.rows[0].user_id !== null) {
        const mode = command.command_type === 'FAN_AUTO' ? 'AUTO' : command.command_type === 'FAN_ON' ? 'ON' : 'OFF';
        await pool.query('UPDATE device_configs SET fan_mode=$2,updated_at=NOW() WHERE device_id=$1', [command.device_id, mode]);
        if (mode === 'AUTO') {
          const sample = await pool.query(
            `SELECT t.humidity, c.humidity_threshold FROM telemetry t JOIN device_configs c ON c.device_id=t.device_id
             WHERE t.device_id=$1 ORDER BY t.recorded_at DESC,t.telemetry_id DESC LIMIT 1`,
            [command.device_id]
          );
          if (sample.rowCount && sample.rows[0].humidity != null && sample.rows[0].humidity_threshold != null) {
            const nextType = sample.rows[0].humidity > sample.rows[0].humidity_threshold ? 'FAN_ON' : 'FAN_OFF';
            void createCommand({ deviceId: command.device_id, type: nextType, automatic: true })
              .catch(error => console.error('Không áp dụng được chế độ quạt tự động:', error.message));
          }
        }
      }
    }
  }
}

module.exports = { createCommand, processAck, setCommandStatus, manualTypes };
