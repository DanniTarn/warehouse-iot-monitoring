const test = require('node:test');
const assert = require('node:assert/strict');
const { env } = require('../src/config/env');
const { formatAlert, send } = require('../src/services/notifications');

const alert = {
  device_id: 1,
  device_code: 'NODE1_ENV',
  alert_type: 'HUMIDITY_HIGH',
  severity: 'CRITICAL',
  alert_message: 'Độ ẩm 72% vượt ngưỡng 65%.'
};

async function withTelegram({ token, chatId, fetch: fakeFetch, warn }, body) {
  const saved = {
    token: env.telegramBotToken,
    chatId: env.telegramChatId,
    fetch: global.fetch,
    warn: console.warn
  };
  env.telegramBotToken = token;
  env.telegramChatId = chatId;
  global.fetch = fakeFetch;
  console.warn = warn || (() => {});
  try {
    return await body();
  } finally {
    env.telegramBotToken = saved.token;
    env.telegramChatId = saved.chatId;
    global.fetch = saved.fetch;
    console.warn = saved.warn;
  }
}

test('Nội dung cảnh báo có mức độ, thiết bị và thông điệp', () => {
  const text = formatAlert(alert, new Date('2026-11-08T10:30:00Z'));
  assert.match(text, /CRITICAL/);
  assert.match(text, /NODE1_ENV/);
  assert.match(text, /Độ ẩm 72% vượt ngưỡng 65%\./);
});

test('Biểu tượng theo mức độ cảnh báo', () => {
  assert.match(formatAlert({ ...alert, severity: 'CRITICAL' }), /^🔴 CRITICAL · NODE1_ENV\n/);
  assert.match(formatAlert({ ...alert, severity: 'WARNING' }), /^🟠 WARNING · NODE1_ENV\n/);
});

test('Thời gian hiển thị theo múi giờ Việt Nam', () => {
  const lines = formatAlert(alert, new Date('2026-11-08T10:30:00Z')).split('\n');
  assert.equal(lines[2], '17:30 08/11/2026');
});

test('Không gọi Telegram khi thiếu token hoặc chat id', async () => {
  let calls = 0;
  const fake = async () => {
    calls += 1;
    return { ok: true, json: async () => ({ ok: true }) };
  };
  await withTelegram({ token: '', chatId: '123', fetch: fake }, () => send(alert));
  await withTelegram({ token: '   ', chatId: '123', fetch: fake }, () => send(alert));
  await withTelegram({ token: 'abc', chatId: '', fetch: fake }, () => send(alert));
  assert.equal(calls, 0);
});

test('Gửi tin nhắn Telegram đúng định dạng API', async () => {
  const calls = [];
  const fake = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ ok: true }) };
  };
  await withTelegram({ token: 'abc', chatId: '123', fetch: fake }, () => send(alert));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.telegram.org/botabc/sendMessage');
  assert.equal(calls[0].options.method, 'POST');
  const payload = JSON.parse(calls[0].options.body);
  assert.equal(payload.chat_id, '123');
  assert.equal(payload.disable_web_page_preview, true);
  assert.match(payload.text, /^🔴 CRITICAL · NODE1_ENV/);
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test('Lỗi gửi Telegram không làm hỏng luồng tạo cảnh báo', async () => {
  const warnings = [];
  const fake = () => Promise.reject(new Error('mất kết nối'));
  await withTelegram(
    { token: 'abc', chatId: '123', fetch: fake, warn: message => warnings.push(message) },
    () => assert.doesNotReject(send(alert))
  );
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /mất kết nối/);
});
