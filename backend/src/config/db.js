const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool, types } = require('pg');

types.setTypeParser(20, value => Number(value));
const { env } = require('./env');

const pool = new Pool({
  connectionString: env.databaseUrl || undefined,
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: true } : undefined
});

async function connectDB() {
  const client = await pool.connect();
  try {
    const migrations = ['001_initial_schema.sql', '002_mongo_outbox.sql'];
    await client.query('BEGIN');
    for (const name of migrations) {
      const schema = await fs.readFile(path.join(__dirname, '../../migrations', name), 'utf8');
      await client.query(schema);
    }
    await client.query('COMMIT');
    console.log('Đã kết nối và kiểm tra cấu trúc PostgreSQL.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, connectDB, transaction };
