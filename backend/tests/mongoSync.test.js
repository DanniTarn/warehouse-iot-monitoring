const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSync({ connected = true, rows = [], error = null } = {}) {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('FROM mongo_outbox')) return { rows };
      return { rows: [], rowCount: 1 };
    }
  };
  const updateOne = async (...args) => {
    calls.push({ updateOne: args });
    if (error) throw error;
    return { matchedCount: 1 };
  };
  const mocks = {
    '../config/db': {
      pool: { query: db.query },
      transaction: async fn => fn(db)
    },
    '../config/mongo': { mongoConnected: () => connected },
    '../models/Telemetry': { Telemetry: { updateOne }, Alert: { updateOne } }
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/services/mongoSync.js'), 'utf8');
  const module = { exports: {} };
  const fn = vm.runInNewContext(`(function(require, module, exports) { ${source}\n})`, { console, setInterval, clearInterval, setTimeout, Promise });
  fn(name => {
    if (!Object.hasOwn(mocks, name)) throw new Error(`Không có module giả lập: ${name}`);
    return mocks[name];
  }, module, module.exports);
  return { ...module.exports, calls };
}

test('MongoDB nhận dữ liệu cảm biến và đánh dấu bản ghi đã đồng bộ', async () => {
  const record = { entity_type: 'telemetry', entity_id: 14, attempt_count: 0, payload: { telemetry_id: 14, temperature: 31.5 } };
  const worker = loadSync({ rows: [record] });
  const result = await worker.syncMongoBatch();
  assert.equal(result.processed, 1);
  assert.equal(result.failed, 0);
  const writing = worker.calls.find(x => x.updateOne);
  assert.deepEqual(JSON.parse(JSON.stringify(writing.updateOne)), [
    { telemetry_id: 14 }, { $set: record.payload }, { upsert: true }
  ]);
  assert.ok(worker.calls.some(x => x.sql && x.sql.includes('delivered_at=NOW()')));
});

test('MongoDB nhận bản cập nhật trạng thái cảnh báo', async () => {
  const record = { entity_type: 'alert', entity_id: 7, attempt_count: 0, payload: { alert_id: 7, is_acknowledged: true } };
  const worker = loadSync({ rows: [record] });
  await worker.syncMongoBatch();
  const writing = worker.calls.find(x => x.updateOne);
  assert.equal(writing.updateOne[0].alert_id, 7);
  assert.equal(writing.updateOne[1].$set.is_acknowledged, true);
});

test('Lỗi ghi MongoDB giữ bản ghi trong hàng đợi để thử lại', async () => {
  const record = { entity_type: 'telemetry', entity_id: 3, attempt_count: 1, payload: { telemetry_id: 3 } };
  const worker = loadSync({ rows: [record], error: new Error('Mất kết nối') });
  const result = await worker.syncMongoBatch();
  assert.equal(result.processed, 0);
  assert.equal(result.failed, 1);
  const retry = worker.calls.find(x => x.sql && x.sql.includes('attempt_count=$3'));
  assert.equal(retry.params[2], 2);
  assert.equal(retry.params[3], 4);
  assert.equal(retry.params[4], 'Mất kết nối');
  assert.equal(worker.calls.some(x => x.sql && x.sql.includes('delivered_at=NOW()')), false);
});

test('MongoDB mất kết nối thì không tiêu thụ hàng đợi', async () => {
  const worker = loadSync({ connected: false });
  assert.equal((await worker.syncMongoBatch()).processed, 0);
  assert.equal(worker.calls.length, 0);
});

test('Thời gian chờ thử lại không tăng quá một phút', () => {
  const worker = loadSync();
  assert.equal(worker.retrySeconds(1), 2);
  assert.equal(worker.retrySeconds(4), 16);
  assert.equal(worker.retrySeconds(20), 60);
});
