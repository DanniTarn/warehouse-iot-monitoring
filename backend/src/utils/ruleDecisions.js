function planRules(code, config, current, previous, atNight) {
  const alerts = [];
  const commands = [];
  const before = previous || {};
  if (code.endsWith('_ENV')) {
    const smokeHigh = current.smoke_gas_level != null && config.smoke_gas_threshold != null && current.smoke_gas_level > config.smoke_gas_threshold;
    const wasSmokeHigh = before.smoke_gas_level != null && config.smoke_gas_threshold != null && before.smoke_gas_level > config.smoke_gas_threshold;
    const tempHigh = current.temperature != null && config.temperature_threshold != null && current.temperature > config.temperature_threshold;
    const wasTempHigh = before.temperature != null && config.temperature_threshold != null && before.temperature > config.temperature_threshold;
    const fire = smokeHigh || tempHigh;
    const previousFire = wasSmokeHigh || wasTempHigh;
    if (fire) {
      if (!previousFire) {
        if (smokeHigh) alerts.push({ type: 'SMOKE_CRITICAL', severity: 'CRITICAL', message: `Nồng độ khói/khí ${current.smoke_gas_level} vượt ngưỡng ${config.smoke_gas_threshold}.` });
        if (tempHigh) alerts.push({ type: 'TEMPERATURE_CRITICAL', severity: 'CRITICAL', message: `Nhiệt độ ${current.temperature}°C vượt ngưỡng ${config.temperature_threshold}°C.` });
        commands.push({ code, type: 'FAN_OFF' });
        commands.push({ code: 'NODE2_SEC', type: 'BUZZER_ON' });
      }
    } else if (current.humidity !== null && config.humidity_threshold !== null) {
      const high = current.humidity > config.humidity_threshold;
      const wasHigh = before.humidity != null && before.humidity > config.humidity_threshold;
      if (high && !wasHigh) {
        alerts.push({ type: 'HUMIDITY_HIGH', severity: 'WARNING', message: `Độ ẩm ${current.humidity}% vượt ngưỡng ${config.humidity_threshold}%.` });
      }
      if (config.fan_mode === 'AUTO' && (before.humidity == null || high !== wasHigh || previousFire)) {
        commands.push({ code, type: high ? 'FAN_ON' : 'FAN_OFF' });
      }
    }
  }
  if (code.endsWith('_SEC') && config.night_mode_enabled) {
    const doorOpened = current.door_status === true && before.door_status !== true;
    const motion = current.motion_detected === true && before.motion_detected !== true;
    if (doorOpened) alerts.push({
      type: 'DOOR_BREACH',
      severity: atNight ? 'CRITICAL' : 'WARNING',
      message: atNight
        ? 'Cửa kho bị mở ngoài giờ làm việc.'
        : 'Cửa kho đang mở trong giờ làm việc.'
    });
    if (motion) alerts.push({
      type: 'MOTION_INTRUSION',
      severity: atNight ? 'CRITICAL' : 'WARNING',
      message: atNight
        ? 'Phát hiện chuyển động trong kho ngoài giờ làm việc.'
        : 'Phát hiện chuyển động trong kho trong giờ làm việc.'
    });
    if (atNight && (doorOpened || motion)) commands.push({ code, type: 'BUZZER_ON' });
  }
  return { alerts, commands };
}

module.exports = { planRules };
