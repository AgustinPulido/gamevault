/**
 * auth.routes.js — register, login and "who am I".
 *
 *   POST /api/auth/register  { name, email, password }  -> { token, user }
 *   POST /api/auth/login     { email, password }        -> { token, user }
 *   GET  /api/auth/me        (requires token)           -> user
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { HttpError } from '../middleware/error-handler.js';
import { validate } from '../utils/validate.js';
import { toIsoUtc } from '../utils/dates.js';

export const authRouter = Router();

/** Public user shape. Note: the password hash is NEVER sent to the client. */
const toPublicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  avatarUrl: u.avatar_url,
  createdAt: toIsoUtc(u.created_at),
});

authRouter.post('/register', (req, res) => {
  validate(req.body, {
    name: ['required', 'min:2', 'max:60'],
    email: ['required', 'email', 'max:120'],
    password: ['required', 'min:6', 'max:100'],
  });
  const { name, email, password } = req.body;

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim());
  if (exists) throw new HttpError(409, 'That email is already registered');

  // bcrypt adds a random "salt" and is intentionally slow, which makes
  // stolen hashes very hard to crack. 10 = cost factor (rounds).
  const hash = bcrypt.hashSync(password, 10);
  const avatar = `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(name)}`;
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (name, email, password_hash, avatar_url) VALUES (?, ?, ?, ?)')
    .run(name.trim(), email.trim().toLowerCase(), hash, avatar);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: toPublicUser(user) });
});

authRouter.post('/login', (req, res) => {
  validate(req.body, { email: ['required', 'email'], password: ['required'] });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(req.body.email.trim());

  // Same message for "no such user" and "wrong password", so attackers
  // can't use the login form to discover which emails are registered.
  if (!user || !bcrypt.compareSync(req.body.password, user.password_hash)) {
    throw new HttpError(401, 'Invalid email or password');
  }
  res.json({ token: signToken(user), user: toPublicUser(user) });
});

authRouter.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) throw new HttpError(404, 'User not found');
  res.json(toPublicUser(user));
});
