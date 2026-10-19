const test = require('node:test');
const assert = require('node:assert/strict');
const { mapTelemetry, nightTime, isOnline } = require('../src/utils/data');
const { parseTopic } = require('../src/services/mqtt');
const { positiveId, nonnegativeInt, enumValue, queryLimit } = require('../src/utils/http');

test('Chuẩn hóa dữ liệu cảm biến môi trường', () => {
  assert.deepEqual(mapTelemetry({ temperature: 32.3, humidity: 62.1, smoke_level: 300 }), {
    temperature: 32.3, humidity: 62.1, smoke_gas_level: 300,
    door_status: null, motion_detected: null
  });
});

test('Chuẩn hóa dữ liệu cảm biến an ninh', () => {
  const value = mapTelemetry({ door_open: 1, motion_detected: 0 });
  assert.equal(value.door_status, true);
  assert.equal(value.motion_detected, false);
  assert.equal(value.temperature, null);
});

test('Từ chối bản tin không hợp lệ', () => {
  assert.equal(mapTelemetry({}), null);
  assert.equal(mapTelemetry({ humidity: 200 }), null);
  assert.equal(mapTelemetry({ temperature: 'không hợp lệ' }), null);
});

test('Nhận dạng đúng các topic đã thống nhất', () => {
  assert.deepEqual(parseTopic('khohang/NODE1_ENV/telemetry'), { code: 'NODE1_ENV', type: 'telemetry' });
  assert.deepEqual(parseTopic('khohang/NODE2_SEC/ack'), { code: 'NODE2_SEC', type: 'ack' });
  assert.deepEqual(parseTopic('khohang/heartbeat'), { code: null, type: 'heartbeat' });
  assert.equal(parseTopic('warehouse/devices/NODE1_ENV/telemetry'), null);
  assert.equal(parseTopic('khohang/NODE2_SEC/unknown'), null);
});

test('Kiểm tra thời gian ngoài giờ làm việc', () => {
  assert.equal(nightTime(new Date('2026-11-08T14:30:00Z'), 'Asia/Ho_Chi_Minh', 20, 6), true);
  assert.equal(nightTime(new Date('2026-11-08T03:30:00Z'), 'Asia/Ho_Chi_Minh', 20, 6), false);
  assert.equal(nightTime(new Date('2026-11-08T22:30:00Z'), 'Asia/Ho_Chi_Minh', 20, 6), true);
});

test('Tính kết nối theo heartbeat và trạng thái', () => {
  const now = Date.parse('2026-11-08T12:00:00Z');
  assert.equal(isOnline({ lifecycle_status: 'ACTIVE', last_heartbeat: '2026-11-08T11:59:20Z' }, now), true);
  assert.equal(isOnline({ lifecycle_status: 'ACTIVE', last_heartbeat: '2026-11-08T11:58:20Z' }, now), false);
  assert.equal(isOnline({ lifecycle_status: 'DECOMMISSIONED', last_heartbeat: '2026-11-08T12:00:00Z' }, now), false);
});

test('Kiểm tra đầu vào API', () => {
  assert.equal(positiveId('12'), 12);
  assert.throws(() => positiveId('0'));
  assert.equal(nonnegativeInt('0'), 0);
  assert.throws(() => nonnegativeInt('-1'));
  assert.throws(() => enumValue('UNKNOWN', ['ADMIN'], 'Vai trò'));
  assert.throws(() => queryLimit('99999'));
});

const { planRules } = require('../src/utils/ruleDecisions');

test('Độ ẩm cao cảnh báo và bật quạt khi ở chế độ tự động', () => {
  const plan = planRules('NODE1_ENV', { humidity_threshold: 65, smoke_gas_threshold: 300, fan_mode: 'AUTO' },
    { humidity: 72, smoke_gas_level: 200 }, { humidity: 60, smoke_gas_level: 200 }, false);
  assert.deepEqual(plan.alerts.map(a => a.type), ['HUMIDITY_HIGH']);
  assert.deepEqual(plan.commands.map(c => c.type), ['FAN_ON']);
});

test('Hạ độ ẩm tắt quạt tự động và không tạo cảnh báo mới', () => {
  const plan = planRules('NODE1_ENV', { humidity_threshold: 65, smoke_gas_threshold: 300, fan_mode: 'AUTO' },
    { humidity: 60, smoke_gas_level: 200 }, { humidity: 75, smoke_gas_level: 200 }, false);
  assert.deepEqual(plan.alerts, []);
  assert.deepEqual(plan.commands.map(c => c.type), ['FAN_OFF']);
});

test('Chế độ quạt thủ công không bị ghi đè', () => {
  const plan = planRules('NODE1_ENV', { humidity_threshold: 65, smoke_gas_threshold: 300, fan_mode: 'ON' },
    { humidity: 30, smoke_gas_level: 200 }, { humidity: 75, smoke_gas_level: 200 }, false);
  assert.deepEqual(plan.commands, []);
});

test('Khói cao kích hoạt cảnh báo và hai lệnh tới Node 2', () => {
  const plan = planRules('NODE1_ENV', { humidity_threshold: 65, smoke_gas_threshold: 300, fan_mode: 'ON' },
    { humidity: 60, smoke_gas_level: 450 }, { humidity: 60, smoke_gas_level: 150 }, false);
  assert.deepEqual(plan.alerts.map(a => a.type), ['SMOKE_CRITICAL']);
  assert.deepEqual(plan.commands, [
    { code: 'NODE1_ENV', type: 'FAN_OFF' },
    { code: 'NODE2_SEC', type: 'BUZZER_ON' }
  ]);
});

test('Phát hiện xâm nhập chỉ khi chế độ đêm bật và đang ngoài giờ', () => {
  const current = { door_status: true, motion_detected: true };
  const before = { door_status: false, motion_detected: false };
  const night = planRules('NODE2_SEC', { night_mode_enabled: true }, current, before, true);
  assert.deepEqual(night.alerts.map(a => a.type), ['DOOR_BREACH', 'MOTION_INTRUSION']);
  assert.deepEqual(night.commands, [{ code: 'NODE2_SEC', type: 'BUZZER_ON' }]);
  assert.equal(planRules('NODE2_SEC', { night_mode_enabled: true }, current, before, false).alerts.length, 0);
  assert.equal(planRules('NODE2_SEC', { night_mode_enabled: false }, current, before, true).alerts.length, 0);
});

test('Không tạo cảnh báo lặp lại nếu ngưỡng vẫn đang vượt', () => {
  const config = { humidity_threshold: 65, smoke_gas_threshold: 300, fan_mode: 'AUTO' };
  const plan = planRules('NODE1_ENV', config,
    { humidity: 72, smoke_gas_level: 450 }, { humidity: 71, smoke_gas_level: 420 }, true);
  assert.deepEqual(plan, { alerts: [], commands: [] });
});
