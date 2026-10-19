const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, transaction } = require('../config/db');
const { env } = require('../config/env');
const { audit } = require('../services/audit');
const { verifyToken } = require('../middlewares/auth');
const { HttpError, requiredString } = require('../utils/http');

const router = express.Router();

router.post('/login', async (req, res) => {
  const username = requiredString(req.body?.username, 'Tên đăng nhập', 50);
  const password = requiredString(req.body?.password, 'Mật khẩu', 1000);
  const result = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
  const user = result.rows[0];
  const valid = user && user.is_active && await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new HttpError(401, 'Sai tên đăng nhập hoặc mật khẩu.');
  const account = await transaction(async db => {
    const updated = await db.query(
      `UPDATE users SET last_login=NOW() WHERE user_id=$1
       RETURNING user_id,username,full_name,email,role,is_active,created_at,last_login`,
      [user.user_id]
    );
    await audit('LOGIN', user.user_id, { username }, req.ip, db);
    return updated.rows[0];
  });
  const token = jwt.sign({ sub: String(user.user_id) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  res.json({ token, user: account });
});

router.get('/me', verifyToken, (req, res) => res.json(req.user));

router.post('/logout', verifyToken, async (req, res) => {
  await audit('LOGOUT', req.user.user_id, null, req.ip);
  res.json({ message: 'Đã ghi nhận đăng xuất.' });
});

module.exports = router;
