-- =============================================================================
-- schema.sql — Relational model of the GameVault store (SQLite dialect)
-- =============================================================================
-- Quick glossary for reading this file:
--   PRIMARY KEY      unique identifier of each row.
--   REFERENCES x(y)  FOREIGN KEY: the value must exist in table x, column y.
--   ON DELETE CASCADE if the parent row is deleted, delete its children too.
--   UNIQUE           no two rows can share that value (or combination).
--   CHECK (...)      a rule every row must satisfy, enforced by the database.
--
-- MONEY IS STORED IN CENTS (INTEGER), e.g. $59.99 -> 5999.
-- Floating point numbers can't represent decimals exactly (0.1 + 0.2 != 0.3),
-- so integer cents is the standard way to avoid rounding bugs with money.
--
-- Relationships at a glance:
--   users 1──* orders 1──* order_items *──1 games
--   users 1──* reviews *──1 games
--   users 1──* cart_items *──1 games      (+ the platform chosen)
--   users *──* games  through wishlist
--   games *──* genres through game_genres
--   games *──* platforms through game_platforms
--   games 1──* game_media  (screenshots and trailers)
-- =============================================================================

-- Drop in reverse dependency order so foreign keys don't complain.
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS coupons;
DROP TABLE IF EXISTS wishlist;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS game_media;
DROP TABLE IF EXISTS game_platforms;
DROP TABLE IF EXISTS game_genres;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS platforms;
DROP TABLE IF EXISTS genres;
DROP TABLE IF EXISTS users;

-- ---------------------------------------------------------------------------
-- USERS: customers and administrators.
-- We never store plain passwords, only a bcrypt hash of them.
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE, -- case-insensitive
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  avatar_url    TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- CATALOG LOOKUP TABLES
-- ---------------------------------------------------------------------------
CREATE TABLE genres (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE platforms (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,   -- short machine-friendly id: 'pc', 'ps5'...
  name TEXT NOT NULL           -- display name: 'PlayStation 5'
);

-- ---------------------------------------------------------------------------
-- GAMES: the products we sell.
-- ---------------------------------------------------------------------------
CREATE TABLE games (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  steam_app_id      INTEGER UNIQUE,
  title             TEXT    NOT NULL,
  slug              TEXT    NOT NULL UNIQUE,   -- used in URLs: /games/elden-ring
  short_description TEXT    NOT NULL,
  description       TEXT    NOT NULL,
  developer         TEXT    NOT NULL,
  publisher         TEXT    NOT NULL,
  release_date      TEXT,                      -- ISO date 'YYYY-MM-DD'
  age_rating        INTEGER NOT NULL DEFAULT 0,
  metacritic        INTEGER CHECK (metacritic BETWEEN 0 AND 100),
  price_cents       INTEGER NOT NULL CHECK (price_cents >= 0),
  discount_percent  INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  stock             INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0), -- digital keys available
  cover_image       TEXT    NOT NULL,          -- vertical box art
  header_image      TEXT    NOT NULL,          -- horizontal banner
  background_image  TEXT,
  featured          INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)), -- SQLite has no BOOLEAN
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Many-to-many: a game has many genres, a genre has many games.
-- The composite PRIMARY KEY prevents linking the same pair twice.
CREATE TABLE game_genres (
  game_id  INTEGER NOT NULL REFERENCES games(id)  ON DELETE CASCADE,
  genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, genre_id)
);

CREATE TABLE game_platforms (
  game_id     INTEGER NOT NULL REFERENCES games(id)     ON DELETE CASCADE,
  platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, platform_id)
);

-- Screenshots and trailers. One table with a "type" column is simpler than
-- two almost identical tables.
CREATE TABLE game_media (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id    INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL CHECK (type IN ('screenshot', 'trailer')),
  url        TEXT    NOT NULL,   -- image URL, or HLS (.m3u8) stream for trailers
  thumbnail  TEXT,
  title      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- REVIEWS: 1-5 stars. A user can review each game only once (UNIQUE).
-- ---------------------------------------------------------------------------
CREATE TABLE reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id    INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (game_id, user_id)
);

-- ---------------------------------------------------------------------------
-- SHOPPING CART (persisted per user, so it survives page reloads / devices).
-- The same game on two platforms = two different lines.
-- ---------------------------------------------------------------------------
CREATE TABLE cart_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  game_id     INTEGER NOT NULL REFERENCES games(id)     ON DELETE CASCADE,
  platform_id INTEGER NOT NULL REFERENCES platforms(id),
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 10),
  added_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, game_id, platform_id)
);

CREATE TABLE wishlist (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id  INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  added_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, game_id)
);

-- ---------------------------------------------------------------------------
-- COUPONS: discount codes the customer can type at checkout.
-- ---------------------------------------------------------------------------
CREATE TABLE coupons (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  description     TEXT    NOT NULL,
  percent_off     INTEGER NOT NULL CHECK (percent_off BETWEEN 1 AND 100),
  min_order_cents INTEGER NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

-- ---------------------------------------------------------------------------
-- ORDERS: header (who, when, totals) + lines (what).
-- Prices and titles are COPIED into order_items ("snapshot"): if a game's
-- price changes tomorrow, old orders must still show what the customer paid.
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  status          TEXT    NOT NULL DEFAULT 'paid'
                  CHECK (status IN ('pending', 'paid', 'completed', 'cancelled', 'refunded')),
  subtotal_cents  INTEGER NOT NULL,   -- sum of lines after per-game discounts
  coupon_code     TEXT,
  discount_cents  INTEGER NOT NULL DEFAULT 0,  -- coupon discount
  tax_cents       INTEGER NOT NULL,
  total_cents     INTEGER NOT NULL,
  billing_name    TEXT    NOT NULL,
  billing_email   TEXT    NOT NULL,
  billing_address TEXT    NOT NULL,
  billing_city    TEXT    NOT NULL,
  billing_country TEXT    NOT NULL,
  payment_method  TEXT    NOT NULL,   -- e.g. 'card'
  payment_last4   TEXT,               -- NEVER store full card numbers
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE order_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  game_id          INTEGER REFERENCES games(id) ON DELETE SET NULL, -- keep history if game is deleted
  platform_name    TEXT    NOT NULL,
  title            TEXT    NOT NULL,
  cover_image      TEXT    NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  quantity         INTEGER NOT NULL CHECK (quantity >= 1),
  activation_keys  TEXT    NOT NULL   -- JSON array with one mock key per unit
);

-- ---------------------------------------------------------------------------
-- INDEXES speed up the queries we run most often (filters and joins).
-- Primary keys and UNIQUE columns are indexed automatically.
-- ---------------------------------------------------------------------------
CREATE INDEX idx_games_price       ON games(price_cents);
CREATE INDEX idx_games_release     ON games(release_date);
CREATE INDEX idx_game_genres_genre ON game_genres(genre_id);
CREATE INDEX idx_game_plat_plat    ON game_platforms(platform_id);
CREATE INDEX idx_media_game        ON game_media(game_id);
CREATE INDEX idx_reviews_game      ON reviews(game_id);
CREATE INDEX idx_orders_user       ON orders(user_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
