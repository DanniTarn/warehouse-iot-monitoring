const express = require('express');
const bcrypt = require('bcryptjs');
const { pool, transaction } = require('../config/db');
const { verifyToken, authorizeRoles } = require('../middlewares/auth');
const { HttpError, requiredString, positiveId, enumValue, boolValue } = require('../utils/http');
const { audit } = require('../services/audit');

const router = express.Router();
router.use(verifyToken, authorizeRoles('ADMIN'));

const publicColumns = 'user_id,username,full_name,email,role,is_active,created_at,last_login';

router.get('/', async (req, res) => {
  const result = await pool.query(`SELECT ${publicColumns} FROM users ORDER BY user_id ASC`);
  res.json(result.rows);
});

router.post('/', async (req, res) => {
  const input = req.body || {};
  const username = requiredString(input.username, 'Tên đăng nhập', 50);
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) throw new HttpError(400, 'Tên đăng nhập chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.');
  const fullName = requiredString(input.full_name, 'Họ tên', 100);
  const password = requiredString(input.password, 'Mật khẩu', 128);
  if (password.length < 8) throw new HttpError(400, 'Mật khẩu cần ít nhất 8 ký tự.');
  const role = enumValue(input.role, ['ADMIN', 'OPERATOR', 'VIEWER'], 'Vai trò');
  const email = input.email == null || input.email === '' ? null : requiredString(input.email, 'Email', 255);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Email không hợp lệ.');
  const hash = await bcrypt.hash(password, 10);
  const account = await transaction(async db => {
    const result = await db.query(
      `INSERT INTO users(username,full_name,password_hash,email,role) VALUES($1,$2,$3,$4,$5)
       RETURNING ${publicColumns}`,
      [username, fullName, hash, email, role]
    );
    await audit('CREATE_USER', req.user.user_id, { user_id: result.rows[0].user_id, username, role }, req.ip, db);
    return result.rows[0];
  });
  res.status(201).json(account);
});

router.patch('/:id', async (req, res) => {
  const id = positiveId(req.params.id, 'Mã người dùng');
  const input = req.body || {};
  const hasRole = Object.hasOwn(input, 'role');
  const hasActive = Object.hasOwn(input, 'is_active');
  if (!hasRole && !hasActive) throw new HttpError(400, 'Chưa có dữ liệu cập nhật.');
  const role = hasRole ? enumValue(input.role, ['ADMIN', 'OPERATOR', 'VIEWER'], 'Vai trò') : null;
  const active = hasActive ? boolValue(input.is_active, 'Trạng thái tài khoản') : null;
  if (id === req.user.user_id && ((hasRole && role !== 'ADMIN') || (hasActive && !active))) {
    throw new HttpError(403, 'Không thể tự khóa hoặc hạ quyền tài khoản đang đăng nhập.');
  }
  const account = await transaction(async db => {
    const existing = await db.query('SELECT role,is_active FROM users WHERE user_id=$1 FOR UPDATE', [id]);
    if (!existing.rowCount) throw new HttpError(404, 'Không tìm thấy tài khoản.');
    if (existing.rows[0].role === 'ADMIN' && ((hasRole && role !== 'ADMIN') || (hasActive && !active))) {
      const admins = await db.query("SELECT COUNT(*)::integer AS count FROM users WHERE role='ADMIN' AND is_active=TRUE");
      if (admins.rows[0].count < 2) throw new HttpError(409, 'Không thể khóa hoặc hạ quyền quản trị viên cuối cùng.');
    }
    const result = await db.query(
      `UPDATE users SET role=COALESCE($2,role),is_active=COALESCE($3,is_active) WHERE user_id=$1
       RETURNING ${publicColumns}`,
      [id, role, active]
    );
    await audit('UPDATE_USER', req.user.user_id, { user_id: id, role, is_active: active }, req.ip, db);
    return result.rows[0];
  });
  res.json(account);
});

module.exports = router;
