const { env } = require('../config/env');

function isOnline(row, now = Date.now()) {
  if (row.lifecycle_status !== 'ACTIVE' || !row.last_heartbeat) return false;
  return now - new Date(row.last_heartbeat).getTime() <= env.offlineSeconds * 1000;
}

function deviceView(row) {
  if (!row) return null;
  const { auth_token_hash, ...publicDevice } = row;
  return { ...publicDevice, online: isOnline(row) };
}

function toBoolean(value) {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  return null;
}

function mapTelemetry(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const numeric = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const fields = {
    temperature: numeric(payload.temperature),
    humidity: numeric(payload.humidity),
    smoke_gas_level: numeric(payload.smoke_gas_level ?? payload.smoke_level),
    door_status: toBoolean(payload.door_status ?? payload.door_open),
    motion_detected: toBoolean(payload.motion_detected)
  };
  if (Object.values(fields).every(v => v === null)) return null;
  if (fields.humidity !== null && (fields.humidity < 0 || fields.humidity > 100)) return null;
  if (fields.smoke_gas_level !== null && fields.smoke_gas_level < 0) return null;
  return fields;
}

function minutesOfDay(now = new Date(), timezone = env.nightTimezone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: timezone
  }).formatToParts(now);
  const value = type => Number(parts.find(part => part.type === type)?.value ?? 0);
  return value('hour') * 60 + value('minute');
}

function nightWindow(now, timezone, startMinutes, endMinutes) {
  const current = minutesOfDay(now, timezone);
  return startMinutes === endMinutes ||
    (startMinutes > endMinutes ? current >= startMinutes || current < endMinutes : current >= startMinutes && current < endMinutes);
}

function nightTime(now = new Date(), timezone = env.nightTimezone, start = env.nightStartHour, end = env.nightEndHour) {
  return nightWindow(now, timezone, start * 60, end * 60);
}

function guardArmed(config, now, timezone, fallbackStart, fallbackEnd) {
  if (config?.guard_mode === 'ON') return true;
  if (config?.guard_mode === 'OFF') return false;
  const startHour = Number.isInteger(config?.curfew_start_hour) ? config.curfew_start_hour : fallbackStart;
  const startMinute = Number.isInteger(config?.curfew_start_minute) ? config.curfew_start_minute : 0;
  const endHour = Number.isInteger(config?.curfew_end_hour) ? config.curfew_end_hour : fallbackEnd;
  const endMinute = Number.isInteger(config?.curfew_end_minute) ? config.curfew_end_minute : 0;
  return nightWindow(now, timezone, startHour * 60 + startMinute, endHour * 60 + endMinute);
}

module.exports = { isOnline, deviceView, toBoolean, mapTelemetry, nightTime, nightWindow, guardArmed };
