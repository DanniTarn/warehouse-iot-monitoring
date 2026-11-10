const mqtt = require('mqtt');
const { env } = require('../config/env');
const { authorizeDevice } = require('./deviceAuth');

let client;
const rejectedAt = new Map();

function warnRejected(code) {
  const now = Date.now();
  if (now - (rejectedAt.get(code) ?? 0) < 60000) return;
  if (rejectedAt.size > 500) rejectedAt.clear();
  rejectedAt.set(code, now);
  console.warn(`Từ chối bản tin MQTT của ${code}: thiếu hoặc sai token thiết bị.`);
}

function isConnected() {
  return Boolean(client && client.connected);
}

function parseTopic(topic, prefix = env.mqttPrefix) {
  const parts = topic.split('/');
  if (parts[0] !== prefix) return null;
  if (parts.length === 2 && parts[1] === 'heartbeat') return { type: 'heartbeat', code: null };
  if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
  if (!['telemetry', 'heartbeat', 'ack'].includes(parts[2])) return null;
  return { type: parts[2], code: parts[1] };
}

async function processMessage(topic, bytes) {
  const parsed = parseTopic(topic);
  if (!parsed || bytes.length > 8192) return;
  let payload;
  try {
    payload = JSON.parse(bytes.toString('utf8'));
  } catch {
    return;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
  const code = parsed.code || payload.device_id || payload.device_code;
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]+$/.test(code)) return;
  if (parsed.code && (payload.device_id || payload.device_code) && (payload.device_id || payload.device_code) !== parsed.code) return;
  if (env.deviceAuthRequired && !await authorizeDevice(code, payload.token)) {
    warnRejected(code);
    return;
  }
  if (parsed.type === 'telemetry') {
    await require('./telemetry').receiveTelemetry(code, payload);
  } else if (parsed.type === 'heartbeat') {
    await require('./telemetry').receiveHeartbeat(code);
  } else if (parsed.type === 'ack') {
    await require('./commands').processAck(code, payload);
  }
}

function startMQTT() {
  client = mqtt.connect(env.mqttUrl, {
    clientId: `${env.mqttClientId}-${process.pid}`,
    username: env.mqttUsername,
    password: env.mqttPassword,
    reconnectPeriod: 2000,
    connectTimeout: 10000
  });
  client.on('connect', () => {
    console.log('Đã kết nối MQTT Broker.');
    client.subscribe([
      `${env.mqttPrefix}/+/telemetry`,
      `${env.mqttPrefix}/+/ack`,
      `${env.mqttPrefix}/+/heartbeat`,
      `${env.mqttPrefix}/heartbeat`
    ], { qos: 1 }, error => {
      if (error) console.error('Không đăng ký được MQTT topic:', error.message);
    });
  });
  client.on('message', (topic, bytes) => {
    void processMessage(topic, bytes).catch(error => console.error('Lỗi xử lý bản tin MQTT:', error.message));
  });
  client.on('error', error => console.error('MQTT Broker gặp lỗi:', error.message));
  client.on('offline', () => console.warn('Mất kết nối MQTT Broker, đang thử kết nối lại.'));
  return client;
}

function publish(code, payload) {
  if (!isConnected()) return Promise.reject(new Error('MQTT Broker chưa kết nối.'));
  return new Promise((resolve, reject) => {
    client.publish(`${env.mqttPrefix}/${code}/command`, JSON.stringify(payload), { qos: 1, retain: false }, error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function stopMQTT() {
  if (!client) return Promise.resolve();
  return new Promise(resolve => client.end(false, {}, resolve));
}

module.exports = { startMQTT, publish, isConnected, stopMQTT, parseTopic, processMessage };
