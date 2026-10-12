/**
 * auth.js — authentication middlewares based on JWT.
 * ---------------------------------------------------------------------------
 * How login works in this app:
 *   1. The user sends email + password to POST /api/auth/login.
 *   2. If correct, the server returns a JWT ("JSON Web Token"): a string
 *      containing { sub: userId, role } SIGNED with our secret key.
 *   3. The frontend stores the token and sends it on every request in the
 *      header:   Authorization: Bearer <token>
 *   4. These middlewares verify the signature. Nobody can forge a token
 *      without the secret, so if it verifies we know who the user is.
 * ---------------------------------------------------------------------------
 */
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from './error-handler.js';

/** Creates a signed token for a user. */
export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/** Reads and verifies the token from the Authorization header (or returns null). */
function readUser(req) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return { id: Number(payload.sub), role: payload.role };
  } catch {
    return null; // expired or tampered token
  }
}

/** Blocks the request with 401 unless a valid token is sent. Sets req.user. */
export function requireAuth(req, res, next) {
  const user = readUser(req);
  if (!user) throw new HttpError(401, 'You must be logged in');
  req.user = user;
  next();
}

/** Like requireAuth, but never blocks: req.user is set only if logged in. */
export function optionalAuth(req, res, next) {
  req.user = readUser(req);
  next();
}

/** Must be used AFTER requireAuth. Allows only admins. */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') throw new HttpError(403, 'Admins only');
  next();
}
