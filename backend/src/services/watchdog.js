const { env } = require('../config/env');
const { pool } = require('../config/db');
const { deviceById, commandById } = require('./store');
const { broadcast } = require('./realtime');
const { createAlert } = require('./alerts');

async function checkOffline() {
  const result = await pool.query(
    `UPDATE nodes SET lifecycle_status='OFFLINE'
     WHERE lifecycle_status='ACTIVE'
     AND COALESCE(last_heartbeat,activated_at,created_at) < NOW() - ($1::integer * INTERVAL '1 second')
     RETURNING device_id`,
    [env.offlineSeconds]
  );
  for (const row of result.rows) {
    const device = await deviceById(row.device_id);
    broadcast('device_status', {
      device_id: device.device_id,
      online: false,
      last_heartbeat: device.last_heartbeat,
      lifecycle_status: device.lifecycle_status
    });
    await createAlert(row.device_id, 'DEVICE_OFFLINE', 'WARNING', `Mất kết nối thiết bị ${device.device_code} quá ${env.offlineSeconds} giây.`);
  }
}

async function checkCommandTimeouts() {
  const result = await pool.query(
    `UPDATE device_controls SET status='FAILED',failure_reason='Không nhận được phản hồi từ thiết bị.'
     WHERE status IN ('PENDING','SENT')
     AND sent_at < NOW() - ($1::integer * INTERVAL '1 second') RETURNING command_id`,
    [env.commandSeconds]
  );
  for (const row of result.rows) broadcast('command_status', await commandById(row.command_id));
}

function startWatchdog() {
  const timer = setInterval(async () => {
    try {
      await checkOffline();
      await checkCommandTimeouts();
    } catch (error) {
      console.error('Lỗi kiểm tra thiết bị hoặc lệnh:', error.message);
    }
  }, 1000);
  timer.unref();
  return () => clearInterval(timer);
}

module.exports = { startWatchdog, checkOffline, checkCommandTimeouts };
