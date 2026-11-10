const { sendChecked } = require('../src/services/notifications');

const alert = {
  device_code: 'TELEGRAM_CHECK',
  severity: 'WARNING',
  alert_message: 'Tin nhắn kiểm tra cấu hình Telegram.'
};

sendChecked(alert)
  .then(() => console.log('ok'))
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
