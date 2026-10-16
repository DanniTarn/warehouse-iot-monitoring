const express = require('express');
const { pool, transaction } = require('../config/db');
const { verifyToken, authorizeRoles } = require('../middlewares/auth');
const { positiveId, nonnegativeInt, queryLimit, enumValue, dateFilter, HttpError } = require('../utils/http');
const { alertSelect, alertById } = require('../services/store');
const { audit } = require('../services/audit');
const { broadcast } = require('../services/realtime');
const { Alert } = require('../models/Telemetry');
const { mongoConnected } = require('../config/mongo');

const router = express.Router();
router.use(verifyToken);

router.get('/archive', async (req, res) => {
  if (!mongoConnected()) throw new HttpError(503, 'MongoDB hiện không kết nối.');
  const filter = {};
  if (req.query.device_id !== undefined) filter.device_id = positiveId(req.query.device_id, 'Mã thiết bị');
  if (req.query.severity !== undefined) filter.severity = enumValue(req.query.severity, ['INFO', 'WARNING', 'CRITICAL'], 'Mức cảnh báo');
  if (req.query.status !== undefined) {
    filter.is_acknowledged = enumValue(req.query.status, ['open', 'resolved'], 'Trạng thái cảnh báo') === 'resolved';
  }
  const created = {};
  if (req.query.from !== undefined) created.$gte = new Date(dateFilter(req.query.from, 'from'));
  if (req.query.to !== undefined) created.$lte = new Date(dateFilter(req.query.to, 'to'));
  if (Object.keys(created).length) filter.created_at = created;
  const limit = queryLimit(req.query.limit, 100);
  const offset = req.query.offset === undefined ? 0 : nonnegativeInt(req.query.offset);
  const rows = await Alert.find(filter).sort({ created_at: -1, alert_id: -1 }).skip(offset).limit(limit).lean();
  res.json(rows.map(({ _id, ...item }) => item));
});

router.get('/', async (req, res) => {
  const where = [];
  const args = [];
  if (req.query.status !== undefined) {
    const value = enumValue(req.query.status, ['open', 'resolved'], 'Trạng thái cảnh báo');
    where.push(`a.is_acknowledged=${value === 'resolved' ? 'TRUE' : 'FALSE'}`);
  }
  if (req.query.severity !== undefined) {
    args.push(enumValue(req.query.severity, ['INFO', 'WARNING', 'CRITICAL'], 'Mức cảnh báo'));
    where.push(`a.severity=$${args.length}`);
  }
  if (req.query.device_id !== undefined) {
    args.push(positiveId(req.query.device_id, 'Mã thiết bị'));
    where.push(`a.device_id=$${args.length}`);
  }
  for (const [key, op] of [['from', '>='], ['to', '<=']]) {
    if (req.query[key] !== undefined) {
      args.push(dateFilter(req.query[key], key));
      where.push(`a.created_at ${op} $${args.length}`);
    }
  }
  args.push(queryLimit(req.query.limit, 100));
  const limit = `$${args.length}`;
  const result = await pool.query(
    `${alertSelect} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY a.created_at DESC,a.alert_id DESC LIMIT ${limit}`,
    args
  );
  res.json(result.rows);
});

router.post('/:id/acknowledge', authorizeRoles('ADMIN', 'OPERATOR'), async (req, res) => {
  const id = positiveId(req.params.id, 'Mã cảnh báo');
  await transaction(async db => {
    const result = await db.query(
      `UPDATE alerts SET is_acknowledged=TRUE,resolved_by_user_id=$2,resolved_at=NOW()
       WHERE alert_id=$1 AND is_acknowledged=FALSE RETURNING alert_id`,
      [id, req.user.user_id]
    );
    if (!result.rowCount) throw new HttpError(409, 'Cảnh báo không tồn tại hoặc đã được xử lý.');
    await audit('ACKNOWLEDGE_ALERT', req.user.user_id, { alert_id: id }, req.ip, db);
  });
  const alert = await alertById(id);
  broadcast('alert_updated', alert);
  res.json(alert);
});

module.exports = router;
