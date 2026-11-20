const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function cleanValue(val) {
  if (Array.isArray(val)) {
    return val.map(cleanValue);
  }
  if (val !== null && typeof val === 'object') {
    const cleaned = {};
    for (const [key, nestedVal] of Object.entries(val)) {
      if (
        key.startsWith('$') ||
        key.includes('.') ||
        FORBIDDEN_KEYS.has(key)
      ) {
        continue;
      }
      cleaned[key] = cleanValue(nestedVal);
    }
    return cleaned;
  }
  return val;
}

function sanitizeRequest(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = cleanValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = cleanValue(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = cleanValue(req.params);
  }
  next();
}

module.exports = { sanitizeRequest, cleanValue };
