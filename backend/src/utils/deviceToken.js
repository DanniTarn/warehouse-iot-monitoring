const crypto = require('node:crypto');

const HEX_64 = /^[a-f0-9]{64}$/;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function verifyDeviceToken(token, expectedHash) {
  if (typeof token !== 'string' || !HEX_64.test(token)) return false;
  if (typeof expectedHash !== 'string' || !HEX_64.test(expectedHash)) return false;
  return crypto.timingSafeEqual(
    Buffer.from(hashToken(token), 'hex'),
    Buffer.from(expectedHash, 'hex')
  );
}

module.exports = { hashToken, verifyDeviceToken };
