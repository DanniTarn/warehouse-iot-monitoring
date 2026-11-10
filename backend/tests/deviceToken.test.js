const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { hashToken, verifyDeviceToken } = require('../src/utils/deviceToken');

const token = 'a'.repeat(64);
const hash = crypto.createHash('sha256').update(token).digest('hex');

test('Token thiết bị khớp thì được chấp nhận', () => {
  assert.equal(hashToken(token), hash);
  assert.equal(verifyDeviceToken(token, hash), true);
});

test('Token sai hoặc sai định dạng thì bị từ chối', () => {
  assert.equal(verifyDeviceToken('b'.repeat(64), hash), false);
  assert.equal(verifyDeviceToken(token.toUpperCase(), hash), false);
  assert.equal(verifyDeviceToken('', hash), false);
  assert.equal(verifyDeviceToken(null, hash), false);
  assert.equal(verifyDeviceToken(token, null), false);
  assert.equal(verifyDeviceToken(token, hash.slice(0, 63)), false);
  assert.equal(verifyDeviceToken(token, 'not-a-hash'), false);
});
