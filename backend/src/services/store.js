const { pool } = require('../config/db');
const { deviceView } = require('../utils/data');
const { HttpError } = require('../utils/http');

const deviceSelect = `SELECT n.device_id, n.device_code, n.device_name, n.warehouse_id,
  w.warehouse_name, n.assigned_user_id, u.username AS assigned_username,
  n.mac_address, n.firmware_version, n.ip_address, n.lifecycle_status,
  n.last_heartbeat, n.activated_at, n.created_at, n.auth_token_suffix
  FROM nodes n LEFT JOIN warehouses w ON w.warehouse_id=n.warehouse_id
  LEFT JOIN users u ON u.user_id=n.assigned_user_id`;

async function deviceById(id, db = pool) {
  const result = await db.query(`${deviceSelect} WHERE n.device_id=$1`, [id]);
  if (!result.rowCount) throw new HttpError(404, 'Không tìm thấy thiết bị.');
  return deviceView(result.rows[0]);
}

async function deviceByCode(code, db = pool) {
  const result = await db.query(`${deviceSelect} WHERE n.device_code=$1`, [code]);
  return result.rowCount ? deviceView(result.rows[0]) : null;
}

const commandSelect = `SELECT c.command_id,c.device_id,n.device_code,c.user_id,
  COALESCE(u.username,'SYSTEM') AS username,c.command_type,c.parameters,
  c.status,c.sent_at,c.acknowledged_at,c.failure_reason
  FROM device_controls c JOIN nodes n ON n.device_id=c.device_id
  LEFT JOIN users u ON u.user_id=c.user_id`;

async function commandById(id, db = pool) {
  const result = await db.query(`${commandSelect} WHERE c.command_id=$1`, [id]);
  if (!result.rowCount) throw new HttpError(404, 'Không tìm thấy lệnh.');
  return result.rows[0];
}

const alertSelect = `SELECT a.alert_id,a.device_id,n.device_code,a.alert_type,a.severity,
  a.alert_message,a.is_acknowledged,a.resolved_by_user_id,
  u.username AS resolved_by_username,a.created_at,a.resolved_at
  FROM alerts a JOIN nodes n ON n.device_id=a.device_id
  LEFT JOIN users u ON u.user_id=a.resolved_by_user_id`;

async function alertById(id, db = pool) {
  const result = await db.query(`${alertSelect} WHERE a.alert_id=$1`, [id]);
  if (!result.rowCount) throw new HttpError(404, 'Không tìm thấy cảnh báo.');
  return result.rows[0];
}

module.exports = { deviceSelect, deviceById, deviceByCode, commandSelect, commandById, alertSelect, alertById };
