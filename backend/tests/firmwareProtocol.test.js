const test = require('node:test');
const assert = require('node:assert/strict');
const { commandPayload, ackDetails, ackStates, deviceStates, thresholdPayload } = require('../src/utils/firmwareProtocol');
const { planRules } = require('../src/utils/ruleDecisions');

test('Gửi lệnh quạt đúng định dạng firmware Node 1', () => {
  assert.deepEqual(commandPayload({ command_id: 11, command_type: 'FAN_ON' }), { command_id: 11, fan: 'on' });
  assert.deepEqual(commandPayload({ command_id: 12, command_type: 'FAN_OFF' }), { command_id: 12, fan: 'off' });
  assert.equal(commandPayload({ command_id: 13, command_type: 'FAN_AUTO' }), null);
});

test('Gửi lệnh còi đúng định dạng firmware Node 2', () => {
  assert.deepEqual(commandPayload({ command_id: 4, command_type: 'BUZZER_ON' }), { command_id: 4, alarm: 'on' });
  assert.deepEqual(commandPayload({ command_id: 5, command_type: 'BUZZER_OFF' }), { command_id: 5, alarm: 'off' });
});

test('Nhận dạng ACK không chứa command_id do firmware hiện tại gửi', () => {
  assert.deepEqual(ackDetails('FAN_ON_ACK'), { type: 'FAN_ON', kind: 'FAN', state: true, successful: true });
  assert.deepEqual(ackDetails('ALARM_OFF_ACK'), { type: 'BUZZER_OFF', kind: 'ALARM', state: false, successful: true });
  assert.equal(ackDetails('other'), null);
  assert.equal(ackDetails('FAILED').successful, false);
});

test('Chỉ cập nhật các actuator có trong Node tương ứng', () => {
  assert.deepEqual(ackStates('NODE1_ENV', 'FAN_OFF_ACK'), [['FAN', false]]);
  assert.deepEqual(ackStates('NODE2_SEC', 'ALARM_ON_ACK'), [['BUZZER', true], ['LED_RED', true]]);
  assert.deepEqual(ackStates('NODE2_SEC', 'FAN_ON_ACK'), []);
});

test('Nhận trạng thái quạt và còi từ payload thực tế của ESP32', () => {
  assert.deepEqual(deviceStates('NODE1_ENV', { fan_state: 'ON' }), [['FAN', true]]);
  assert.deepEqual(deviceStates('NODE2_SEC', { alarm_state: 'OFF' }), [['BUZZER', false], ['LED_RED', false]]);
  assert.deepEqual(deviceStates('NODE1_ENV', { fan_state: 'INVALID' }), []);
});

test('Đồng bộ ngưỡng cấu hình đúng tên trường mà Node 1 sử dụng', () => {
  assert.deepEqual(thresholdPayload({ temperature_threshold: 50, humidity_threshold: 65, smoke_gas_threshold: 800 }), {
    threshold_t: 50, threshold_h: 65, threshold_gas: 800
  });
  assert.equal(thresholdPayload({}), null);
});

test('Khi nghi cháy thì tắt quạt dù độ ẩm cao', () => {
  const config = { humidity_threshold: 65, smoke_gas_threshold: 800, temperature_threshold: 50, fan_mode: 'AUTO' };
  const plan = planRules('NODE1_ENV', config,
    { temperature: 51, humidity: 90, smoke_gas_level: 900 },
    { temperature: 30, humidity: 60, smoke_gas_level: 100 }, false);
  assert.deepEqual(plan.commands, [{ code: 'NODE1_ENV', type: 'FAN_OFF' }, { code: 'NODE2_SEC', type: 'BUZZER_ON' }]);
  assert.deepEqual(plan.alerts.map(x => x.type), ['SMOKE_CRITICAL', 'TEMPERATURE_CRITICAL']);
});

test('Đèn Node 2 được firmware điều khiển cùng còi', () => {
  const plan = planRules('NODE1_ENV', { humidity_threshold: 65, smoke_gas_threshold: 800, temperature_threshold: 50, fan_mode: 'AUTO' },
    { humidity: 45, temperature: 30, smoke_gas_level: 950 },
    { humidity: 45, temperature: 30, smoke_gas_level: 100 }, false);
  assert.deepEqual(plan.commands, [{ code: 'NODE1_ENV', type: 'FAN_OFF' }, { code: 'NODE2_SEC', type: 'BUZZER_ON' }]);
});
