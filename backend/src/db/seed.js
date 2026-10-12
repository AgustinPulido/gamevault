/**
 * seed.js
 * ---------------------------------------------------------------------------
 * Fills the database with MOCK DATA so the store isn't empty:
 *   - 36 real games (from seed-data/games.json, fetched from Steam)
 *   - genres and platforms
 *   - an admin, a demo customer and several "community" users
 *   - reviews, coupons, a wishlist and a few past orders
 *
 * Usage:
 *   npm run seed       -> wipes the database and recreates everything
 *   (The server also calls seedDatabase() automatically on first start.)
 * ---------------------------------------------------------------------------
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { db, createSchema, transaction } from './database.js';
import { generateActivationKey } from '../utils/keys.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const games = JSON.parse(readFileSync(path.join(__dirname, 'seed-data/games.json'), 'utf8'));

// ---------------------------------------------------------------------------
// A tiny "seeded" random number generator (mulberry32).
// Math.random() gives different numbers every run; a seeded generator gives
// the SAME sequence every time, so the mock data is reproducible.
// ---------------------------------------------------------------------------
function createRandom(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // number in [0, 1)
  };
}
const random = createRandom(42);
const randomInt = (min, max) => Math.floor(random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(random() * arr.length)];

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------------------------------------------------------------------------
// Static mock data
// ---------------------------------------------------------------------------
const PLATFORMS = [
  { code: 'pc', name: 'PC' },
  { code: 'ps5', name: 'PlayStation 5' },
  { code: 'xbox', name: 'Xbox Series X|S' },
  { code: 'switch', name: 'Nintendo Switch' },
];

const USERS = [
  { name: 'Admin', email: 'admin@gamevault.dev', password: 'admin123', role: 'admin' },
  { name: 'Demo Player', email: 'demo@gamevault.dev', password: 'demo123', role: 'customer' },
  // "Community" users that author the mock reviews.
  { name: 'Sofia Martinez', email: 'sofia@example.com' },
  { name: 'Liam Chen', email: 'liam@example.com' },
  { name: 'Olivia Rossi', email: 'olivia@example.com' },
  { name: 'Noah Williams', email: 'noah@example.com' },
  { name: 'Mateo Fernandez', email: 'mateo@example.com' },
  { name: 'Emma Schmidt', email: 'emma@example.com' },
  { name: 'Lucas Silva', email: 'lucas@example.com' },
  { name: 'Mia Johnson', email: 'mia@example.com' },
  { name: 'Hiro Tanaka', email: 'hiro@example.com' },
  { name: 'Valentina Lopez', email: 'valentina@example.com' },
];

// Review templates grouped by star rating. {game} is replaced by the title.
const REVIEW_TEMPLATES = {
  5: [
    ['Masterpiece', 'One of the best games I have ever played. {game} nails the gameplay, the art direction and the soundtrack.'],
    ['Instant classic', "I couldn't put it down. Hours flew by and I'm already planning my second playthrough."],
    ['Worth every penny', '{game} is packed with content and polish. Highly recommended to anyone who enjoys the genre.'],
  ],
  4: [
    ['Really good', 'Great experience overall. A few minor bugs here and there, but nothing that ruins the fun.'],
    ['Solid and fun', '{game} has excellent mechanics. The ending felt a bit rushed, though.'],
    ['Recommended', 'Beautiful visuals and satisfying progression. Performance could be slightly better on my setup.'],
  ],
  3: [
    ['Decent', 'It is fine. Some parts of {game} are brilliant, others get repetitive after a while.'],
    ['Mixed feelings', 'Good ideas but uneven execution. Wait for a sale.'],
  ],
  2: [
    ['Not for me', 'I wanted to like {game} but the difficulty curve and pacing pushed me away.'],
  ],
  1: [
    ['Disappointed', 'Crashed several times on launch. Maybe patches will fix it.'],
  ],
};

const COUPONS = [
  { code: 'WELCOME10', description: '10% off your first purchase', percent_off: 10, min_order_cents: 0 },
  { code: 'GAMER20', description: '20% off orders over $50', percent_off: 20, min_order_cents: 5000 },
  { code: 'MEGA50', description: '50% off orders over $150', percent_off: 50, min_order_cents: 15000 },
  { code: 'EXPIRED5', description: 'Old promo (inactive)', percent_off: 5, min_order_cents: 0, active: 0 },
];

/** Picks a star rating biased by the game's Metacritic score (better games, better reviews). */
function ratingFor(metacritic) {
  const base = metacritic ? (metacritic - 50) / 10 : 3.5; // 90 -> 4, 70 -> 2
  const r = Math.round(base + (random() * 2 - 0.6));
  return Math.min(5, Math.max(1, r));
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------
export function seedDatabase() {
  console.log('🌱 Creating schema...');
  createSchema();

  transaction(() => {
    // --- Platforms -----------------------------------------------------------
    const insertPlatform = db.prepare('INSERT INTO platforms (code, name) VALUES (?, ?)');
    const platformIds = {}; // code -> id, e.g. { pc: 1, ps5: 2 }
    for (const p of PLATFORMS) {
      platformIds[p.code] = Number(insertPlatform.run(p.code, p.name).lastInsertRowid);
    }

    // --- Genres (collected from all games, without duplicates) --------------
    const insertGenre = db.prepare('INSERT INTO genres (name, slug) VALUES (?, ?)');
    const genreIds = {};
    const allGenres = [...new Set(games.flatMap((g) => g.genres))].sort();
    for (const name of allGenres) {
      genreIds[name] = Number(insertGenre.run(name, slugify(name)).lastInsertRowid);
    }

    // --- Users (passwords are hashed with bcrypt) ---------------------------
    const insertUser = db.prepare(
      'INSERT INTO users (name, email, password_hash, role, avatar_url) VALUES (?, ?, ?, ?, ?)',
    );
    const userIds = [];
    for (const u of USERS) {
      const hash = bcrypt.hashSync(u.password ?? 'password123', 10);
      // DiceBear generates a unique avatar image from any text (free, no key).
      const avatar = `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(u.name)}`;
      userIds.push(Number(insertUser.run(u.name, u.email, hash, u.role ?? 'customer', avatar).lastInsertRowid));
    }
    const [, demoUserId, ...communityIds] = userIds;

    // --- Games + their genres, platforms and media ---------------------------
    const insertGame = db.prepare(`
      INSERT INTO games (steam_app_id, title, slug, short_description, description, developer,
        publisher, release_date, age_rating, metacritic, price_cents, discount_percent, stock,
        cover_image, header_image, background_image, featured)
      VALUES (:steamAppId, :title, :slug, :shortDescription, :description, :developer,
        :publisher, :releaseDate, :ageRating, :metacritic, :priceCents, :discountPercent, :stock,
        :coverImage, :headerImage, :backgroundImage, :featured)
    `);
    const linkGenre = db.prepare('INSERT INTO game_genres (game_id, genre_id) VALUES (?, ?)');
    const linkPlatform = db.prepare('INSERT INTO game_platforms (game_id, platform_id) VALUES (?, ?)');
    const insertMedia = db.prepare(
      'INSERT INTO game_media (game_id, type, url, thumbnail, title, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    );

    const gameRows = []; // keep { id, ...game } for reviews/orders below
    games.forEach((g, index) => {
      // Mock stock: most games have plenty, a couple are sold out / running low.
      const stock = index % 13 === 5 ? 0 : index % 7 === 3 ? randomInt(1, 4) : randomInt(15, 200);
      // Mock discount on some games that Steam doesn't have on sale right now.
      const discount = g.discountPercent || (index % 6 === 2 ? pick([10, 20, 25, 33, 40]) : 0);

      const { lastInsertRowid } = insertGame.run({
        steamAppId: g.steamAppId,
        title: g.title,
        slug: g.slug,
        shortDescription: g.shortDescription,
        description: g.description,
        developer: g.developer,
        publisher: g.publisher,
        releaseDate: g.releaseDate,
        ageRating: g.ageRating,
        metacritic: g.metacritic,
        priceCents: Math.round(g.price * 100), // dollars -> cents
        discountPercent: g.price > 0 ? discount : 0,
        stock,
        coverImage: g.coverImage,
        headerImage: g.headerImage,
        backgroundImage: g.backgroundImage,
        featured: g.featured ? 1 : 0,
      });
      const gameId = Number(lastInsertRowid);
      gameRows.push({ ...g, id: gameId, priceCents: Math.round(g.price * 100), discount });

      g.genres.forEach((name) => linkGenre.run(gameId, genreIds[name]));
      g.platforms.forEach((code) => linkPlatform.run(gameId, platformIds[code]));
      g.screenshots.forEach((url, i) => insertMedia.run(gameId, 'screenshot', url, null, null, i));
      g.trailers.forEach((t, i) => insertMedia.run(gameId, 'trailer', t.url, t.thumbnail, t.title, i));
    });

    // --- Reviews: 2-6 random community reviews per game ----------------------
    const insertReview = db.prepare(
      `INSERT INTO reviews (game_id, user_id, rating, title, body, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', ?))`,
    );
    for (const game of gameRows) {
      const reviewers = [...communityIds].sort(() => random() - 0.5).slice(0, randomInt(2, 6));
      for (const userId of reviewers) {
        const rating = ratingFor(game.metacritic);
        const [title, body] = pick(REVIEW_TEMPLATES[rating]);
        const daysAgo = `-${randomInt(1, 400)} days`; // spread reviews over the last year
        insertReview.run(game.id, userId, rating, title, body.replaceAll('{game}', game.title), daysAgo);
      }
    }

    // --- Coupons ---------------------------------------------------------------
    const insertCoupon = db.prepare(
      'INSERT INTO coupons (code, description, percent_off, min_order_cents, active) VALUES (?, ?, ?, ?, ?)',
    );
    COUPONS.forEach((c) => insertCoupon.run(c.code, c.description, c.percent_off, c.min_order_cents, c.active ?? 1));

    // --- Demo user's wishlist ---------------------------------------------------
    const insertWish = db.prepare('INSERT INTO wishlist (user_id, game_id) VALUES (?, ?)');
    gameRows.slice(10, 14).forEach((g) => insertWish.run(demoUserId, g.id));

    // --- Two past orders for the demo user ---------------------------------------
    const insertOrder = db.prepare(`
      INSERT INTO orders (user_id, status, subtotal_cents, discount_cents, tax_cents, total_cents,
        billing_name, billing_email, billing_address, billing_city, billing_country,
        payment_method, payment_last4, created_at)
      VALUES (?, ?, ?, 0, ?, ?, 'Demo Player', 'demo@gamevault.dev', '742 Evergreen Terrace',
        'Springfield', 'United States', 'card', '4242', datetime('now', ?))
    `);
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, game_id, platform_name, title, cover_image,
        unit_price_cents, quantity, activation_keys)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `);
    const pastOrders = [
      { games: [gameRows[5], gameRows[7]], status: 'completed', when: '-60 days' },
      { games: [gameRows[0]], status: 'completed', when: '-12 days' },
    ];
    for (const o of pastOrders) {
      const unitPrices = o.games.map((g) => Math.round(g.priceCents * (1 - g.discount / 100)));
      const subtotal = unitPrices.reduce((a, b) => a + b, 0);
      const tax = Math.round(subtotal * 0.08);
      const orderId = Number(insertOrder.run(demoUserId, o.status, subtotal, tax, subtotal + tax, o.when).lastInsertRowid);
      o.games.forEach((g, i) =>
        insertItem.run(orderId, g.id, 'PC', g.title, g.coverImage, unitPrices[i], JSON.stringify([generateActivationKey()])),
      );
    }

    console.log(
      `✅ Seeded ${gameRows.length} games, ${allGenres.length} genres, ${PLATFORMS.length} platforms, ` +
      `${USERS.length} users, ${COUPONS.length} coupons.`,
    );
  });
}

// If this file is executed directly (`npm run seed`) run the seed now.
// When it is imported by server.js, this block is skipped.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seedDatabase();
}
