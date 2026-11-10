const { transaction, pool } = require('../config/db');
const { mongoConnected } = require('../config/mongo');
const { Telemetry, Alert } = require('../models/Telemetry');

function collectionFor(type) {
  if (type === 'telemetry') return { model: Telemetry, key: 'telemetry_id' };
  if (type === 'alert') return { model: Alert, key: 'alert_id' };
  throw new Error('Loại dữ liệu đồng bộ không hợp lệ.');
}

function retrySeconds(attempt) {
  return Math.min(60, 2 ** Math.min(attempt, 6));
}

async function syncMongoBatch(limit = 100) {
  if (!mongoConnected()) return { processed: 0, failed: 0 };
  return transaction(async db => {
    const pending = await db.query(
      `SELECT entity_type, entity_id, payload, attempt_count
       FROM mongo_outbox
       WHERE delivered_at IS NULL AND next_attempt_at <= NOW()
       ORDER BY changed_at, entity_type, entity_id
       LIMIT $1 FOR UPDATE SKIP LOCKED`,
      [limit]
    );
    let processed = 0;
    let failed = 0;
    for (const item of pending.rows) {
      try {
        const { model, key } = collectionFor(item.entity_type);
        await model.updateOne(
          { [key]: Number(item.entity_id) },
          { $set: item.payload },
          { upsert: true }
        );
        await db.query(
          `UPDATE mongo_outbox SET delivered_at=NOW(), last_error=NULL
           WHERE entity_type=$1 AND entity_id=$2`,
          [item.entity_type, item.entity_id]
        );
        processed += 1;
      } catch (error) {
        const attempt = item.attempt_count + 1;
        await db.query(
          `UPDATE mongo_outbox
           SET attempt_count=$3, next_attempt_at=NOW()+($4::int * INTERVAL '1 second'), last_error=$5
           WHERE entity_type=$1 AND entity_id=$2`,
          [item.entity_type, item.entity_id, attempt, retrySeconds(attempt), String(error.message).slice(0, 1000)]
        );
        failed += 1;
      }
    }
    return { processed, failed };
  });
}

async function getMongoStatus() {
  const query = await pool.query('SELECT COUNT(*)::int AS pending FROM mongo_outbox WHERE delivered_at IS NULL');
  return { connected: mongoConnected(), pending: query.rows[0].pending };
}

async function purgeDeviceArchive(deviceId) {
  if (!mongoConnected()) return { telemetry: 0, alerts: 0 };
  const [telemetry, alerts] = await Promise.all([
    Telemetry.deleteMany({ device_id: deviceId }),
    Alert.deleteMany({ device_id: deviceId })
  ]);
  return { telemetry: telemetry.deletedCount, alerts: alerts.deletedCount };
}

function startMongoSync() {
  let busy = false;
  const run = async () => {
    if (busy || !mongoConnected()) return;
    busy = true;
    try {
      const result = await syncMongoBatch();
      if (result.failed) console.warn(`MongoDB: ${result.failed} bản ghi chưa đồng bộ, sẽ thử lại.`);
    } catch (error) {
      console.error('Lỗi đồng bộ dữ liệu MongoDB:', error.message);
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void run(), 1000);
  timer.unref();
  void run();
  return async () => {
    clearInterval(timer);
    while (busy) await new Promise(resolve => setTimeout(resolve, 50));
  };
}

module.exports = { syncMongoBatch, startMongoSync, getMongoStatus, purgeDeviceArchive, retrySeconds, collectionFor };
