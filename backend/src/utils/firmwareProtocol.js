function commandPayload(command) {
  const base = { command_id: command.command_id };
  const types = {
    FAN_ON: { fan: 'on' },
    FAN_OFF: { fan: 'off' },
    BUZZER_ON: { alarm: 'on' },
    BUZZER_OFF: { alarm: 'off' },
    LED_RED: { alarm: 'on' }
  };
  const fields = types[command.command_type];
  return fields ? { ...base, ...fields } : null;
}

function ackDetails(status) {
  const text = typeof status === 'string' ? status.toUpperCase() : '';
  const known = {
    FAN_ON_ACK: { type: 'FAN_ON', kind: 'FAN', state: true, successful: true },
    FAN_OFF_ACK: { type: 'FAN_OFF', kind: 'FAN', state: false, successful: true },
    ALARM_ON_ACK: { type: 'BUZZER_ON', kind: 'ALARM', state: true, successful: true },
    ALARM_OFF_ACK: { type: 'BUZZER_OFF', kind: 'ALARM', state: false, successful: true }
  };
  if (known[text]) return known[text];
  if (['ACKNOWLEDGED', 'ACK', 'ACKED', 'OK', 'SUCCESS', 'DONE'].includes(text)) return { type: null, kind: null, state: null, successful: true };
  if (['FAILED', 'ERROR'].includes(text)) return { type: null, kind: null, state: null, successful: false };
  return null;
}

function deviceStates(code, payload) {
  if (!payload || typeof payload !== 'object') return [];
  if (code.endsWith('_ENV')) {
    const state = String(payload.fan_state || '').toUpperCase();
    if (state === 'ON' || state === 'OFF') return [['FAN', state === 'ON']];
  }
  if (code.endsWith('_SEC')) {
    const state = String(payload.alarm_state || '').toUpperCase();
    if (state === 'ON' || state === 'OFF') return [['BUZZER', state === 'ON'], ['LED_RED', state === 'ON']];
  }
  return [];
}

function ackStates(code, status) {
  const details = ackDetails(status);
  if (!details) return [];
  if (code.endsWith('_ENV') && details.kind === 'FAN') return [['FAN', details.state]];
  if (code.endsWith('_SEC') && details.kind === 'ALARM') return [['BUZZER', details.state], ['LED_RED', details.state]];
  return [];
}

function thresholdPayload(config) {
  if (!config) return null;
  const values = {
    threshold_t: config.temperature_threshold,
    threshold_h: config.humidity_threshold,
    threshold_gas: config.smoke_gas_threshold
  };
  const payload = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && Number.isFinite(Number(value))) payload[key] = Number(value);
  }
  return Object.keys(payload).length ? payload : null;
}

module.exports = { commandPayload, ackDetails, ackStates, deviceStates, thresholdPayload };
