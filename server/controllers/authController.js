const jwt = require('jsonwebtoken');
const { config } = require('../config/env');
const { matchPasskeyToRole, generateRoleToken } = require('../services/authService');

const isHttpsClient = config.clientUrl.startsWith('https://');
const useCrossSiteCookies =
  process.env.NODE_ENV === 'production' || isHttpsClient;

const COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  sameSite: useCrossSiteCookies ? 'none' : 'lax',
  secure: useCrossSiteCookies,
  path: '/',
};

const COOKIE_OPTIONS = {
  ...COOKIE_BASE_OPTIONS,
  maxAge: 8 * 60 * 60 * 1000,
};

function login(req, res) {
  const { passkey } = req.body || {};
  if (typeof passkey !== 'string' || passkey.trim().length === 0) {
    return res.status(400).json({ error: 'Passkey is required' });
  }

  const role = matchPasskeyToRole(passkey.trim());
  if (!role) {
    return res.status(401).json({ error: 'Invalid passkey' });
  }

  const token = generateRoleToken(role);
  res.cookie('token', token, COOKIE_OPTIONS);
  return res.status(200).json({ role });
}

function logout(_req, res) {
  res.clearCookie('token', COOKIE_BASE_OPTIONS);
  return res.status(200).json({ message: 'Session terminated' });
}

function getMe(req, res) {
  return res.status(200).json({ role: req.user.role });
}

function getSession(req, res) {
  const token = req.cookies?.token;
  if (!token || typeof token !== 'string') {
    return res.status(200).json({ authenticated: false, role: null });
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
    });
    const role = Number(decoded.role);
    if (![1, 2, 3, 4].includes(role)) {
      return res.status(200).json({ authenticated: false, role: null });
    }
    return res.status(200).json({ authenticated: true, role });
  } catch (_err) {
    return res.status(200).json({ authenticated: false, role: null });
  }
}

module.exports = { login, logout, getMe, getSession };
