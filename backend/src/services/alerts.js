const { pool } = require('../config/db');
const { alertById } = require('./store');
const { broadcast } = require('./realtime');
const notifications = require('./notifications');

async function createAlert(deviceId, type, severity, message) {
  const result = await pool.query(
    `INSERT INTO alerts(device_id,alert_type,severity,alert_message)
     VALUES($1,$2,$3,$4)
     ON CONFLICT(device_id,alert_type) WHERE is_acknowledged=FALSE DO NOTHING
     RETURNING alert_id`,
    [deviceId, type, severity, message]
  );
  if (!result.rowCount) return null;
  const alert = await alertById(result.rows[0].alert_id);
  broadcast('alert_created', alert);
  notifications.send(alert).catch(() => {});
  console.log(`Cảnh báo ${type} từ ${alert.device_code}: ${message}`);
  return alert;
}

module.exports = { createAlert };
