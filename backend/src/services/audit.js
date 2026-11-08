const { pool } = require('../config/db');

async function audit(action, userId, details = null, ip = null, db = pool) {
  await db.query(
    'INSERT INTO audit_logs(user_id, action, ip_client, details) VALUES($1,$2,$3,$4)',
    [userId || null, action, ip || null, details ? JSON.stringify(details) : null]
  );
}

module.exports = { audit };
