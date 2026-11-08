const express = require('express');
const cors = require('cors');
const { pool } = require('./config/db');
const { env } = require('./config/env');
const { HttpError } = require('./utils/http');

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: (origin, callback) => {
  if (!origin || env.corsOrigins.includes('*') || env.corsOrigins.includes(origin)) return callback(null, true);
  return callback(new HttpError(403, 'Nguồn truy cập không được phép.'));
} }));
app.use(express.json({ limit: '64kb' }));

app.get('/health', async (req, res) => {
  await pool.query('SELECT 1');
  const mongo = await require('./services/mongoSync').getMongoStatus();
  res.status(mongo.connected ? 200 : 503).json({
    status: mongo.connected ? 'ok' : 'degraded',
    postgres_connected: true,
    mongodb_connected: mongo.connected,
    mongodb_pending_records: mongo.pending,
    mqtt_connected: require('./services/mqtt').isConnected()
  });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/telemetry', require('./routes/telemetry'));
app.use('/api/commands', require('./routes/commands'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/users', require('./routes/users'));
app.use('/api/audit-logs', require('./routes/audit'));
app.use('/api/warehouses', require('./routes/warehouses'));

const { verifyToken, authorizeRoles } = require('./middlewares/auth');
const { createCommand, manualTypes } = require('./services/commands');
const { positiveId, enumValue } = require('./utils/http');
app.post('/api/devices/:id/commands', verifyToken, authorizeRoles('ADMIN', 'OPERATOR'), async (req, res) => {
  const command = await createCommand({
    deviceId: positiveId(req.params.id),
    type: enumValue(req.body?.command_type, manualTypes, 'Loại lệnh'),
    parameters: req.body?.parameters ?? null,
    userId: req.user.user_id,
    ip: req.ip
  });
  res.status(201).json(command);
});

app.use((req, res, next) => next(new HttpError(404, 'Không tìm thấy API.')));
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ message: 'Dữ liệu JSON không hợp lệ.' });
  }
  if (error.code === '23505') return res.status(409).json({ message: 'Dữ liệu đã tồn tại.' });
  if (error.code === '23503' || error.code === '23514') return res.status(400).json({ message: 'Dữ liệu liên kết không hợp lệ.' });
  const status = error.status >= 400 && error.status < 600 ? error.status : 500;
  if (status === 500) console.error('Lỗi máy chủ:', error);
  return res.status(status).json({ message: status === 500 ? 'Máy chủ gặp lỗi, vui lòng thử lại.' : error.message });
});

module.exports = app;
