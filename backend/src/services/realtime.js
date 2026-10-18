const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { URL } = require('node:url');
const { env } = require('../config/env');
const { pool } = require('../config/db');

let server;

function startRealtime(httpServer) {
  server = new WebSocket.Server({ noServer: true });
  httpServer.on('upgrade', async (request, socket, head) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname !== '/ws') {
        socket.destroy();
        return;
      }
      const origin = request.headers.origin;
      if (origin && !env.corsOrigins.includes('*') && !env.corsOrigins.includes(origin)) throw new Error('Nguồn kết nối không được cho phép.');
      const token = url.searchParams.get('token');
      if (!token) throw new Error('Thiếu token.');
      const claims = jwt.verify(token, env.jwtSecret);
      const result = await pool.query('SELECT is_active FROM users WHERE user_id=$1', [claims.sub]);
      if (!result.rowCount || !result.rows[0].is_active) throw new Error('Tài khoản không hợp lệ.');
      server.handleUpgrade(request, socket, head, ws => server.emit('connection', ws));
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
    }
  });
  return server;
}

function broadcast(type, data) {
  if (!server) return;
  const message = JSON.stringify({ type, data });
  for (const client of server.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  }
}

function closeRealtime() {
  if (!server) return Promise.resolve();
  for (const client of server.clients) client.terminate();
  return new Promise(resolve => server.close(resolve));
}

module.exports = { startRealtime, broadcast, closeRealtime };
