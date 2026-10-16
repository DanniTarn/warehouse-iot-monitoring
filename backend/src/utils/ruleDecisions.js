function planRules(code, config, current, previous, atNight) {
  const alerts = [];
  const commands = [];
  const before = previous || {};
  if (code.endsWith('_ENV')) {
    if (current.humidity !== null && config.humidity_threshold !== null) {
      const high = current.humidity > config.humidity_threshold;
      const wasHigh = before.humidity != null && before.humidity > config.humidity_threshold;
      if (high && !wasHigh) {
        alerts.push({ type: 'HUMIDITY_HIGH', severity: 'WARNING', message: `Độ ẩm ${current.humidity}% vượt ngưỡng ${config.humidity_threshold}%.` });
      }
      if (config.fan_mode === 'AUTO' && (before.humidity == null || high !== wasHigh)) {
        commands.push({ code, type: high ? 'FAN_ON' : 'FAN_OFF' });
      }
    }
    if (current.smoke_gas_level !== null && config.smoke_gas_threshold !== null) {
      const high = current.smoke_gas_level > config.smoke_gas_threshold;
      const wasHigh = before.smoke_gas_level != null && before.smoke_gas_level > config.smoke_gas_threshold;
      if (high && !wasHigh) {
        alerts.push({ type: 'SMOKE_CRITICAL', severity: 'CRITICAL', message: `Nồng độ khói/khí ${current.smoke_gas_level} vượt ngưỡng ${config.smoke_gas_threshold}.` });
        commands.push({ code: 'NODE2_SEC', type: 'BUZZER_ON' });
        commands.push({ code: 'NODE2_SEC', type: 'LED_RED' });
      }
    }
  }
  if (code.endsWith('_SEC') && config.night_mode_enabled && atNight) {
    const doorOpened = current.door_status === true && before.door_status !== true;
    const motion = current.motion_detected === true && before.motion_detected !== true;
    if (doorOpened) alerts.push({ type: 'DOOR_BREACH', severity: 'CRITICAL', message: 'Cửa kho bị mở ngoài giờ làm việc.' });
    if (motion) alerts.push({ type: 'MOTION_INTRUSION', severity: 'CRITICAL', message: 'Phát hiện chuyển động trong kho ngoài giờ làm việc.' });
    if (doorOpened || motion) commands.push({ code, type: 'BUZZER_ON' });
  }
  return { alerts, commands };
}

module.exports = { planRules };
