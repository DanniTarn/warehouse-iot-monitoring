const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { pool } = require('../config/db');
const { HttpError } = require('../utils/http');
const { audit } = require('../services/audit');

async function verifyToken(req, res, next) {
  try {
    const authorization = req.get('authorization') || '';
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match) throw new HttpError(401, 'Vui lòng đăng nhập.');
    let payload;
    try {
      payload = jwt.verify(match[1], env.jwtSecret);
    } catch {
      throw new HttpError(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    }
    const result = await pool.query(
      'SELECT user_id, username, full_name, email, role, is_active, created_at, last_login FROM users WHERE user_id=$1',
      [payload.sub]
    );
    if (!result.rowCount || !result.rows[0].is_active) throw new HttpError(401, 'Tài khoản đã bị khóa hoặc không tồn tại.');
    req.user = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

function authorizeRoles(...roles) {
  return async (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      try {
        await audit('UNAUTHORIZED_ATTEMPT', req.user.user_id, { path: req.originalUrl, role: req.user.role }, req.ip);
      } catch (error) {
        console.error('Không ghi được nhật ký từ chối:', error.message);
      }
      return next(new HttpError(403, 'Bạn không có quyền thực hiện thao tác này.'));
    }
    next();
  };
}

module.exports = { verifyToken, authorizeRoles };
