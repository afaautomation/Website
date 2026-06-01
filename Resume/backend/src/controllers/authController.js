const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../config/database');
const { generateTokens } = require('../middleware/auth');
const logger = require('../config/logger');

async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  const { name, email, phone, password } = req.body;
  const db = await getDb();

  const existing = await db.get('SELECT id FROM users WHERE email = ?', email);
  if (existing) return res.status(409).json({ success: false, message: 'Email already registered' });

  const hashed = await bcrypt.hash(password, 12);
  const id = uuidv4();
  await db.run('INSERT INTO users (id, email, password, name, phone) VALUES (?, ?, ?, ?, ?)', id, email, hashed, name, phone || null);

  const { access, refresh } = generateTokens(id);
  logger.info(`New user registered: ${email}`);
  return res.status(201).json({
    success: true,
    user: { id, email, name, phone: phone || null, plan: 'free' },
    tokens: { access, refresh },
  });
}

async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  const { email, password } = req.body;
  const db = await getDb();

  const user = await db.get('SELECT * FROM users WHERE email = ?', email);
  if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

  const { access, refresh } = generateTokens(user.id);
  logger.info(`User logged in: ${email}`);
  return res.json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
    tokens: { access, refresh },
  });
}

async function refreshToken(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const { access, refresh } = generateTokens(decoded.id);
    return res.json({ success: true, tokens: { access, refresh } });
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
}

async function getMe(req, res) {
  const db = await getDb();
  const user = await db.get('SELECT id, email, name, plan, avatar_url, created_at FROM users WHERE id = ?', req.user.id);
  return res.json({ success: true, user });
}

async function updateProfile(req, res) {
  const { name, currentPassword, newPassword } = req.body;
  const db = await getDb();
  const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);

  if (newPassword) {
    if (!currentPassword) return res.status(400).json({ success: false, message: 'Current password required' });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password incorrect' });
    const hashed = await bcrypt.hash(newPassword, 12);
    await db.run('UPDATE users SET password = ?, updated_at = datetime("now") WHERE id = ?', hashed, req.user.id);
  }

  if (name) {
    await db.run('UPDATE users SET name = ?, updated_at = datetime("now") WHERE id = ?', name, req.user.id);
  }

  const updated = await db.get('SELECT id, email, name, plan, avatar_url FROM users WHERE id = ?', req.user.id);
  return res.json({ success: true, user: updated });
}

module.exports = { register, login, refreshToken, getMe, updateProfile, registerRules: [], loginRules: [] };