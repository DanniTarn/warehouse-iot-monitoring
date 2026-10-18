const mongoose = require('mongoose');
const { env } = require('./env');

mongoose.set('bufferCommands', false);

function mongoConnected() {
  return mongoose.connection.readyState === 1;
}

async function connectMongo() {
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
    autoIndex: true
  });
  console.log('Đã kết nối MongoDB để lưu lịch sử cảm biến và cảnh báo.');
}

async function closeMongo() {
  await mongoose.disconnect();
}

module.exports = { connectMongo, closeMongo, mongoConnected };
