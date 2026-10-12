/**
 * config.js
 * ---------------------------------------------------------------------------
 * Central place for configuration values. Each value can be overridden with
 * an environment variable (useful in production), and falls back to a
 * sensible default for local development.
 *
 * Example (PowerShell):  $env:PORT=4000; npm start
 * ---------------------------------------------------------------------------
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// In ES modules there is no __dirname, so we rebuild it from the file URL.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT) || 3000,

  // Where the SQLite database file lives (created automatically).
  dbPath: process.env.DB_PATH || path.join(__dirname, '../data/gamevault.db'),

  // Secret used to sign login tokens (JWT). CHANGE IT in production!
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: '7d',

  // Frontend URL allowed to call the API from the browser (CORS).
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200',

  // Mock sales tax applied at checkout (8%).
  taxRate: 0.08,
};
