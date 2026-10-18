const http = require('node:http');
const app = require('./app');
const { checkConfig, env } = require('./config/env');
const { connectDB, pool } = require('./config/db');
const { startMQTT, stopMQTT } = require('./services/mqtt');
const { startRealtime, closeRealtime } = require('./services/realtime');
const { startWatchdog } = require('./services/watchdog');
const { connectMongo, closeMongo } = require('./config/mongo');
const { startMongoSync } = require('./services/mongoSync');

async function main() {
  checkConfig();
  await connectDB();
  await connectMongo();
  const stopMongoSync = startMongoSync();
  const server = http.createServer(app);
  startRealtime(server);
  startMQTT();
  const stopWatchdog = startWatchdog();
  server.listen(env.port, () => console.log(`Backend IoT đang chạy tại http://localhost:${env.port}`));
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    stopWatchdog();
    await stopMongoSync();
    await Promise.allSettled([
      new Promise(resolve => server.close(resolve)),
      stopMQTT(),
      closeRealtime()
    ]);
    await Promise.allSettled([pool.end(), closeMongo()]);
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch(error => {
  console.error('Không thể khởi động Backend:', error.message);
  process.exitCode = 1;
  Promise.allSettled([pool.end(), closeMongo()]).catch(() => {});
});
