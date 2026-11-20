const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

function sha256Buffer(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest();
}

function matchPasskeyToRole(candidatePasskey, passkeysMap = config.passkeys) {
  if (typeof candidatePasskey !== 'string' || candidatePasskey.length === 0) {
    return null;
  }

  const candidateDigest = sha256Buffer(candidatePasskey);
  let matchedRole = null;

  for (const role of [1, 2, 3, 4]) {
    const targetDigest = sha256Buffer(passkeysMap[role]);
    const isEqual = crypto.timingSafeEqual(candidateDigest, targetDigest);
    if (isEqual) {
      matchedRole = role;
    }
  }

  return matchedRole;
}

function generateRoleToken(role) {
  return jwt.sign({ role }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '8h',
  });
}

module.exports = { matchPasskeyToRole, generateRoleToken };
