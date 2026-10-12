/**
 * database.js
 * ---------------------------------------------------------------------------
 * Opens the SQLite database and exports a single shared connection.
 *
 * We use `node:sqlite`, the SQLite driver BUILT INTO Node.js (v22.5+).
 * No extra package and no database server to install: the whole database is
 * a single file (data/gamevault.db). You can open it with any SQLite viewer,
 * e.g. the "SQLite Viewer" VS Code extension or DB Browser for SQLite.
 *
 * The API is synchronous, which keeps the code simple:
 *    db.prepare('SELECT * FROM games WHERE id = ?').get(5)   -> one row
 *    db.prepare('SELECT * FROM games').all()                 -> array of rows
 *    db.prepare('INSERT ...').run(a, b)                      -> { lastInsertRowid, changes }
 *
 * IMPORTANT: always pass values as parameters (`?` or `:name`), never by
 * concatenating strings. Parameters prevent SQL injection attacks.
 * ---------------------------------------------------------------------------
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Make sure the folder that will contain the .db file exists.
mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

// SQLite needs foreign key checks to be enabled per connection.
db.exec('PRAGMA foreign_keys = ON;');
// WAL mode = better performance when reading and writing at the same time.
db.exec('PRAGMA journal_mode = WAL;');

/**
 * Runs `fn` inside a TRANSACTION: either ALL its statements succeed, or
 * NONE of them are applied (ROLLBACK). Essential for checkout, where we
 * create an order, decrease stock and empty the cart as one single unit.
 */
export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** (Re)creates every table by executing schema.sql. Deletes existing data! */
export function createSchema() {
  const sql = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(sql);
}

/** True if the database already has the tables and the catalog loaded. */
export function isSeeded() {
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'games'")
    .get();
  if (!table) return false;
  return db.prepare('SELECT COUNT(*) AS n FROM games').get().n > 0;
}
