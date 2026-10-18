class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requiredString(value, name, max = 100) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, `${name} không hợp lệ.`);
  }
  return value.trim();
}

function optionalNumber(value, name, min, max) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new HttpError(400, `${name} không hợp lệ.`);
  }
  return number;
}

function positiveId(value, name = 'ID') {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new HttpError(400, `${name} không hợp lệ.`);
  return number;
}

function nonnegativeInt(value, name = 'Vị trí dữ liệu') {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new HttpError(400, `${name} không hợp lệ.`);
  return number;
}

function queryLimit(value, fallback = 50, max = 500) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) throw new HttpError(400, 'Giới hạn dữ liệu không hợp lệ.');
  return number;
}

function dateFilter(value, name) {
  if (value === undefined) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${name === 'to' ? '23:59:59.999' : '00:00:00'}+07:00`
    : value;
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) throw new HttpError(400, `${name} không hợp lệ.`);
  return date.toISOString();
}

function enumValue(value, allowed, name) {
  if (!allowed.includes(value)) throw new HttpError(400, `${name} không hợp lệ.`);
  return value;
}

function boolValue(value, name) {
  if (typeof value !== 'boolean') throw new HttpError(400, `${name} phải là true hoặc false.`);
  return value;
}

module.exports = { HttpError, requiredString, optionalNumber, positiveId, nonnegativeInt, queryLimit, dateFilter, enumValue, boolValue };
