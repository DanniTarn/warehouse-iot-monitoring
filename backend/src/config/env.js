require('dotenv').config();

const intValue = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const env = {
  port: intValue('PORT', 3000),
  databaseUrl: process.env.DATABASE_URL || process.env.PG_URI || '',
  mongoUri: process.env.MONGO_URI || '',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(x => x.trim()),
  mqttUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  mqttPrefix: process.env.MQTT_TOPIC_PREFIX || 'khohang',
  mqttUsername: process.env.MQTT_USERNAME || undefined,
  mqttPassword: process.env.MQTT_PASSWORD || undefined,
  mqttClientId: process.env.MQTT_CLIENT_ID || 'warehouse-backend',
  offlineSeconds: intValue('OFFLINE_TIMEOUT_SECONDS', 90),
  commandSeconds: intValue('COMMAND_TIMEOUT_SECONDS', 10),
  nightTimezone: process.env.NIGHT_TIMEZONE || 'Asia/Ho_Chi_Minh',
  nightStartHour: Number(process.env.NIGHT_START_HOUR ?? 20),
  nightEndHour: Number(process.env.NIGHT_END_HOUR ?? 6),
  seedDefaultNodes: process.env.SEED_DEFAULT_NODES === 'true'
};

function checkConfig() {
  if (!env.databaseUrl && !process.env.PGHOST) throw new Error('Chưa cấu hình DATABASE_URL hoặc PGHOST.');
  if (!/^mongodb(\+srv)?:\/\//.test(env.mongoUri)) throw new Error('Chưa cấu hình MONGO_URI hợp lệ.');
  if (env.jwtSecret.length < 32) throw new Error('JWT_SECRET cần tối thiểu 32 ký tự.');
  if (!/^[a-zA-Z0-9_-]+$/.test(env.mqttPrefix)) throw new Error('MQTT_TOPIC_PREFIX không hợp lệ.');
  if (![env.nightStartHour, env.nightEndHour].every(n => Number.isInteger(n) && n >= 0 && n < 24)) {
    throw new Error('Giờ bắt đầu hoặc kết thúc chế độ ban đêm không hợp lệ.');
  }
}

module.exports = { env, checkConfig };
