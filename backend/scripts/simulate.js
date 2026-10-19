const mqtt = require('mqtt');
const { env } = require('../src/config/env');

const client = mqtt.connect(env.mqttUrl, {
  clientId: `warehouse-simulator-${process.pid}`,
  username: env.mqttUsername,
  password: env.mqttPassword
});
let temperature = 30;
let humidity = 60;
let smoke = 200;
let door = 0;
let motion = 0;

function send(topic, payload) {
  client.publish(`${env.mqttPrefix}/${topic}`, JSON.stringify(payload), { qos: 1 });
}

function heartbeat() {
  for (const code of ['NODE1_ENV', 'NODE2_SEC']) send('heartbeat', { device_id: code, status: 'online' });
}

function telemetry() {
  temperature = temperature === 30 ? 32 : 30;
  humidity = humidity === 60 ? 70 : 60;
  smoke = smoke === 200 ? 350 : 200;
  door = door ? 0 : 1;
  motion = motion ? 0 : 1;
  send('NODE1_ENV/telemetry', { device_id: 'NODE1_ENV', temperature, humidity, smoke_level: smoke });
  send('NODE2_SEC/telemetry', { device_id: 'NODE2_SEC', door_open: door, motion_detected: motion });
  console.log('Đã gửi dữ liệu cảm biến mô phỏng.');
}

client.on('connect', () => {
  console.log('Bộ mô phỏng đã kết nối MQTT Broker.');
  client.subscribe([`${env.mqttPrefix}/NODE1_ENV/command`, `${env.mqttPrefix}/NODE2_SEC/command`], { qos: 1 });
  heartbeat();
  telemetry();
});

client.on('message', (topic, bytes) => {
  try {
    const code = topic.split('/')[1];
    const command = JSON.parse(bytes.toString());
    if (!command.command_id) return;
    console.log(`Đã nhận lệnh ${command.command} cho ${code}.`);
    send(`${code}/ack`, { device_id: code, command_id: command.command_id, status: 'ACKNOWLEDGED' });
  } catch (error) {
    console.error('Không xử lý được lệnh mô phỏng:', error.message);
  }
});
client.on('error', error => console.error('Bộ mô phỏng gặp lỗi:', error.message));
setInterval(telemetry, 5000);
setInterval(heartbeat, 30000);
