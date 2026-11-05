const { env } = require('../config/env');

const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

function formatAlert(alert, now = new Date()) {
  const parts = Object.fromEntries(clock.formatToParts(now).map(part => [part.type, part.value]));
  const emoji = alert.severity === 'CRITICAL' ? '🔴' : '🟠';
  return [
    `${emoji} ${alert.severity} · ${alert.device_code}`,
    alert.alert_message,
    `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}/${parts.year}`
  ].join('\n');
}

function configured() {
  return Boolean(env.telegramBotToken.trim() && env.telegramChatId.trim());
}

async function sendChecked(alert) {
  if (!configured()) throw new Error('Chưa cấu hình TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID.');
  const response = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.telegramChatId,
      text: formatAlert(alert),
      disable_web_page_preview: true
    }),
    signal: AbortSignal.timeout(5000)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    throw new Error(body?.description || `Telegram trả về HTTP ${response.status}.`);
  }
}

async function send(alert) {
  if (!configured()) return;
  try {
    await sendChecked(alert);
  } catch (error) {
    console.warn(`Không gửi được cảnh báo Telegram: ${error.message}`);
  }
}

module.exports = { formatAlert, send, sendChecked };
