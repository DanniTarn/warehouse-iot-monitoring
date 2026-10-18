const express = require('express');
const { pool } = require('../config/db');
const { verifyToken } = require('../middlewares/auth');
const { positiveId, nonnegativeInt, queryLimit, dateFilter, HttpError } = require('../utils/http');
const { Telemetry } = require('../models/Telemetry');
const { mongoConnected } = require('../config/mongo');

const router = express.Router();
router.use(verifyToken);

const columns = `SELECT t.telemetry_id,t.device_id,n.device_code,t.temperature,t.humidity,
  t.smoke_gas_level,t.door_status,t.motion_detected,t.recorded_at
  FROM telemetry t JOIN nodes n ON n.device_id=t.device_id`;

router.get('/archive', async (req, res) => {
  if (!mongoConnected()) throw new HttpError(503, 'MongoDB hiện không kết nối.');
  const filter = {};
  if (req.query.device_id !== undefined) filter.device_id = positiveId(req.query.device_id, 'Mã thiết bị');
  const recorded = {};
  if (req.query.from !== undefined) recorded.$gte = new Date(dateFilter(req.query.from, 'from'));
  if (req.query.to !== undefined) recorded.$lte = new Date(dateFilter(req.query.to, 'to'));
  if (Object.keys(recorded).length) filter.recorded_at = recorded;
  const limit = queryLimit(req.query.limit);
  const offset = req.query.offset === undefined ? 0 : nonnegativeInt(req.query.offset);
  const rows = await Telemetry.find(filter).sort({ recorded_at: -1, telemetry_id: -1 }).skip(offset).limit(limit).lean();
  res.json(rows.map(({ _id, ...item }) => item));
});

router.get('/latest', async (req, res) => {
  const result = await pool.query(
    `SELECT DISTINCT ON(t.device_id) t.telemetry_id,t.device_id,n.device_code,t.temperature,t.humidity,
     t.smoke_gas_level,t.door_status,t.motion_detected,t.recorded_at
     FROM telemetry t JOIN nodes n ON n.device_id=t.device_id
     ORDER BY t.device_id,t.recorded_at DESC,t.telemetry_id DESC`
  );
  res.json(result.rows);
});

router.get('/', async (req, res) => {
  const where = [];
  const args = [];
  if (req.query.device_id !== undefined) {
    args.push(positiveId(req.query.device_id, 'Mã thiết bị'));
    where.push(`t.device_id=$${args.length}`);
  }
  for (const [key, op] of [['from', '>='], ['to', '<=']]) {
    if (req.query[key] !== undefined) {
      args.push(dateFilter(req.query[key], key));
      where.push(`t.recorded_at ${op} $${args.length}`);
    }
  }
  args.push(queryLimit(req.query.limit));
  const limitParam = `$${args.length}`;
  args.push(req.query.offset === undefined ? 0 : nonnegativeInt(req.query.offset));
  const result = await pool.query(
    `${columns} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY t.recorded_at DESC,t.telemetry_id DESC LIMIT ${limitParam} OFFSET $${args.length}`,
    args
  );
  res.json(result.rows);
});

module.exports = router;
