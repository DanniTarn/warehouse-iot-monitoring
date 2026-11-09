const { env } = require('../config/env');
const { deviceByCode } = require('./store');
const { createAlert } = require('./alerts');
const { createCommand } = require('./commands');
const { nightWindow, guardArmed } = require('../utils/data');
const { planRules } = require('../utils/ruleDecisions');

async function automaticCommand(device, commandType) {
  if (!device || device.lifecycle_status !== 'ACTIVE') return;
  try {
    await createCommand({ deviceId: device.device_id, type: commandType, automatic: true });
  } catch (error) {
    console.error(`Chưa gửi được lệnh tự động ${commandType}:`, error.message);
  }
}

async function evaluateRules(device, config, current, previous) {
  const startHour = Number.isInteger(config?.curfew_start_hour) ? config.curfew_start_hour : env.nightStartHour;
  const startMinute = Number.isInteger(config?.curfew_start_minute) ? config.curfew_start_minute : 0;
  const endHour = Number.isInteger(config?.curfew_end_hour) ? config.curfew_end_hour : env.nightEndHour;
  const endMinute = Number.isInteger(config?.curfew_end_minute) ? config.curfew_end_minute : 0;
  const night = nightWindow(
    new Date(),
    env.nightTimezone,
    startHour * 60 + startMinute,
    endHour * 60 + endMinute
  );
  const armed = guardArmed(config, new Date(), env.nightTimezone, env.nightStartHour, env.nightEndHour);
  const { alerts, commands } = planRules(device.device_code, config, current, previous, night, armed);
  for (const alert of alerts) {
    await createAlert(device.device_id, alert.type, alert.severity, alert.message);
  }
  for (const command of commands) {
    const target = command.code === device.device_code ? device : await deviceByCode(command.code);
    await automaticCommand(target, command.type);
  }
}

module.exports = { evaluateRules };
