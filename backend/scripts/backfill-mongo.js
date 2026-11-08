const { connectDB, pool } = require('../src/config/db');
const { connectMongo, closeMongo } = require('../src/config/mongo');
const { syncMongoBatch } = require('../src/services/mongoSync');
const { checkConfig } = require('../src/config/env');

async function main() {
  checkConfig();
  await connectDB();
  await connectMongo();
  const telemetry = await pool.query(
    `INSERT INTO mongo_outbox(entity_type, entity_id, payload)
     SELECT 'telemetry', t.telemetry_id, to_jsonb(t) || jsonb_build_object('device_code', n.device_code)
     FROM telemetry t JOIN nodes n ON n.device_id=t.device_id
     ON CONFLICT(entity_type, entity_id) DO UPDATE
     SET payload=EXCLUDED.payload, delivered_at=NULL, next_attempt_at=NOW(), attempt_count=0, last_error=NULL
     RETURNING entity_id`
  );
  const alerts = await pool.query(
    `INSERT INTO mongo_outbox(entity_type, entity_id, payload)
     SELECT 'alert', a.alert_id, to_jsonb(a) || jsonb_build_object('device_code', n.device_code)
     FROM alerts a JOIN nodes n ON n.device_id=a.device_id
     ON CONFLICT(entity_type, entity_id) DO UPDATE
     SET payload=EXCLUDED.payload, delivered_at=NULL, next_attempt_at=NOW(), attempt_count=0, last_error=NULL
     RETURNING entity_id`
  );
  console.log(`Đã đưa ${telemetry.rowCount} dữ liệu cảm biến và ${alerts.rowCount} cảnh báo vào hàng đợi MongoDB.`);
  let processed = 0;
  while (true) {
    const batch = await syncMongoBatch(500);
    processed += batch.processed;
    if (!batch.processed && !batch.failed) break;
    if (!batch.processed && batch.failed) break;
  }
  console.log(`Đã đồng bộ ${processed} bản ghi sang MongoDB.`);
}

main().catch(error => {
  console.error('Không thể đồng bộ dữ liệu cũ sang MongoDB:', error.message);
  process.exitCode = 1;
}).finally(async () => {
  await Promise.allSettled([pool.end(), closeMongo()]);
});
