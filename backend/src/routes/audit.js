const express = require('express');
const { pool } = require('../config/db');
const { verifyToken, authorizeRoles } = require('../middlewares/auth');
const { positiveId, queryLimit, dateFilter } = require('../utils/http');

const router = express.Router();
router.use(verifyToken, authorizeRoles('ADMIN'));

router.get('/', async (req, res) => {
  const where = [];
  const args = [];
  if (req.query.user_id !== undefined) {
    args.push(positiveId(req.query.user_id, 'Mã người dùng'));
    where.push(`a.user_id=$${args.length}`);
  }
  for (const [key, op] of [['from', '>='], ['to', '<=']]) {
    if (req.query[key] !== undefined) {
      args.push(dateFilter(req.query[key], key));
      where.push(`a.created_at ${op} $${args.length}`);
    }
  }
  args.push(queryLimit(req.query.limit));
  const max = `$${args.length}`;
  const result = await pool.query(
    `SELECT a.log_id,a.user_id,COALESCE(u.username,'SYSTEM') AS username,a.action,a.ip_client,a.details,a.created_at
     FROM audit_logs a LEFT JOIN users u ON u.user_id=a.user_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY a.created_at DESC,a.log_id DESC LIMIT ${max}`,
    args
  );
  res.json(result.rows);
});

module.exports = router;
