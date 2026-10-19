const express = require('express');
const { pool } = require('../config/db');
const { verifyToken, authorizeRoles } = require('../middlewares/auth');
const { HttpError, positiveId, queryLimit, dateFilter, enumValue } = require('../utils/http');
const { deviceById, commandSelect } = require('../services/store');
const { createCommand, manualTypes } = require('../services/commands');

const router = express.Router();
router.use(verifyToken);

router.get('/', async (req, res) => {
  const where = [];
  const args = [];
  if (req.query.device_id !== undefined) {
    args.push(positiveId(req.query.device_id, 'Mã thiết bị'));
    where.push(`c.device_id=$${args.length}`);
  }
  for (const [key, op] of [['from', '>='], ['to', '<=']]) {
    if (req.query[key] !== undefined) {
      args.push(dateFilter(req.query[key], key));
      where.push(`c.sent_at ${op} $${args.length}`);
    }
  }
  args.push(queryLimit(req.query.limit));
  const max = `$${args.length}`;
  const result = await pool.query(
    `${commandSelect} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY c.sent_at DESC,c.command_id DESC LIMIT ${max}`,
    args
  );
  res.json(result.rows);
});

router.post('/device/:id', authorizeRoles('ADMIN', 'OPERATOR'), async (req, res) => {
  const deviceId = positiveId(req.params.id, 'Mã thiết bị');
  const type = enumValue(req.body?.command_type, manualTypes, 'Loại lệnh');
  await deviceById(deviceId);
  const command = await createCommand({
    deviceId,
    type,
    parameters: req.body?.parameters ?? null,
    userId: req.user.user_id,
    ip: req.ip
  });
  res.status(201).json(command);
});

module.exports = router;
