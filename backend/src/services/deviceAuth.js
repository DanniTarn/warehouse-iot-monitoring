const { pool } = require('../config/db');
const { verifyDeviceToken } = require('../utils/deviceToken');

async function authorizeDevice(code, token) {
  const result = await pool.query('SELECT auth_token_hash FROM nodes WHERE device_code=$1', [code]);
  if (!result.rowCount) return false;
  return verifyDeviceToken(token, result.rows[0].auth_token_hash);
}

module.exports = { authorizeDevice };
