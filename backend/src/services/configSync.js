const { pool } = require('../config/db');
const mqtt = require('./mqtt');
const { thresholdPayload } = require('../utils/firmwareProtocol');

async function syncThresholds(deviceId, code) {
  if (!code.endsWith('_ENV') || !mqtt.isConnected()) return false;
  const result = await pool.query('SELECT temperature_threshold,humidity_threshold,smoke_gas_threshold FROM device_configs WHERE device_id=$1', [deviceId]);
  if (!result.rowCount) return false;
  const payload = thresholdPayload(result.rows[0]);
  if (!payload) return false;
  await mqtt.publish(code, payload);
  return true;
}

async function syncGuardMode(deviceId, code, enabled) {
  if (!code.endsWith('_SEC') || !mqtt.isConnected()) return false;
  await mqtt.publish(code, { guard_mode: enabled ? 'on' : 'off' });
  return true;
}

module.exports = { syncThresholds, syncGuardMode };
