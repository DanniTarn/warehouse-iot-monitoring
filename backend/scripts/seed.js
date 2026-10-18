const bcrypt = require('bcryptjs');
const { checkConfig, env } = require('../src/config/env');
const { connectDB, pool, transaction } = require('../src/config/db');

async function main() {
  checkConfig();
  const accounts = [
    ['admin', 'Quản trị viên', 'ADMIN', process.env.SEED_ADMIN_PASSWORD],
    ['operator01', 'Nhân viên vận hành', 'OPERATOR', process.env.SEED_OPERATOR_PASSWORD],
    ['viewer01', 'Tài khoản giám sát', 'VIEWER', process.env.SEED_VIEWER_PASSWORD]
  ];
  if (accounts.some(row => !row[3] || row[3].length < 8)) {
    throw new Error('Hãy đặt SEED_ADMIN_PASSWORD, SEED_OPERATOR_PASSWORD và SEED_VIEWER_PASSWORD (tối thiểu 8 ký tự).');
  }
  await connectDB();
  await transaction(async db => {
    for (const [username, fullName, role, password] of accounts) {
      const hash = await bcrypt.hash(password, 10);
      await db.query(
        `INSERT INTO users(username,full_name,role,password_hash) VALUES($1,$2,$3,$4)
         ON CONFLICT(username) DO NOTHING`,
        [username, fullName, role, hash]
      );
    }
    if (env.seedDefaultNodes) {
      const sampleNodes = [
        ['NODE1_ENV', 'Node 1 · Môi trường', '02:00:00:00:00:01'],
        ['NODE2_SEC', 'Node 2 · An ninh', '02:00:00:00:00:02']
      ];
      for (const [code, name, mac] of sampleNodes) {
        const result = await db.query(
          `INSERT INTO nodes(device_code,device_name,warehouse_id,mac_address,lifecycle_status,activated_at)
           VALUES($1,$2,(SELECT warehouse_id FROM warehouses WHERE warehouse_name='Kho chính'),$3,'ACTIVE',NOW())
           ON CONFLICT(device_code) DO NOTHING RETURNING device_id`,
          [code, name, mac]
        );
        if (!result.rowCount) continue;
        const id = result.rows[0].device_id;
        await db.query('INSERT INTO device_configs(device_id) VALUES($1)', [id]);
        const types = code.endsWith('_ENV') ? [['DHT22_TEMPERATURE','°C'], ['DHT22_HUMIDITY','%'], ['MQ2_SMOKE','ppm']] : [['MC38_DOOR',null],['PIR_MOTION',null]];
        const actuators = code.endsWith('_ENV') ? ['FAN'] : ['BUZZER','LED_RED'];
        for (const [type, unit] of types) await db.query('INSERT INTO sensors(device_id,sensor_type,unit) VALUES($1,$2,$3)', [id,type,unit]);
        for (const type of actuators) await db.query('INSERT INTO actuators(device_id,actuator_type) VALUES($1,$2)', [id,type]);
      }
    }
  });
  console.log('Đã tạo các tài khoản chưa tồn tại và dữ liệu demo được yêu cầu.');
}

main().catch(error => {
  console.error('Không thể khởi tạo dữ liệu:', error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
