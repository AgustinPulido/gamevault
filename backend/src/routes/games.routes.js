/**
 * games.routes.js — public catalog endpoints.
 *
 *   GET /api/games              search + filters + sorting + pagination
 *   GET /api/games/home         curated sections for the home page
 *   GET /api/games/:slug        full detail of one game
 *   GET /api/genres             list of genres (with game count)
 *   GET /api/platforms          list of platforms
 */
import { Router } from 'express';
import { db } from '../db/database.js';
import { HttpError } from '../middleware/error-handler.js';
import { GAME_SUMMARY_SELECT, querySummaries, toGameSummary } from '../services/game.service.js';

export const gamesRouter = Router();
export const catalogRouter = Router();

// Allowed sort options -> SQL ORDER BY. Using a whitelist (instead of putting
// the user's text directly into SQL) prevents SQL injection.
const SORTS = {
  relevance: 'g.featured DESC, g.metacritic DESC NULLS LAST, g.title',
  newest: 'g.release_date DESC',
  oldest: 'g.release_date ASC',
  price_asc: 'final_price_cents ASC, g.title',
  price_desc: 'final_price_cents DESC, g.title',
  rating: 'avg_rating DESC NULLS LAST, review_count DESC',
  metacritic: 'g.metacritic DESC NULLS LAST',
  title: 'g.title COLLATE NOCASE ASC',
  discount: 'g.discount_percent DESC, final_price_cents ASC',
};

/**
 * GET /api/games?q=souls&genre=rpg&platform=ps5&minPrice=10&maxPrice=40
 *               &onSale=true&inStock=true&sort=price_asc&page=1&limit=12
 */
gamesRouter.get('/', (req, res) => {
  const { q, genre, platform, minPrice, maxPrice, onSale, inStock, sort = 'relevance' } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 12));

  // We build the WHERE clause piece by piece. Every user value goes into
  // `params` and is referenced with "?" — never concatenated into the SQL.
  const where = [];
  const params = [];

  if (q) {
    where.push('(g.title LIKE ? OR g.developer LIKE ? OR g.publisher LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (genre) {
    where.push(`EXISTS (SELECT 1 FROM game_genres gg JOIN genres ge ON ge.id = gg.genre_id
                        WHERE gg.game_id = g.id AND ge.slug = ?)`);
    params.push(genre);
  }
  if (platform) {
    where.push(`EXISTS (SELECT 1 FROM game_platforms gp JOIN platforms p ON p.id = gp.platform_id
                        WHERE gp.game_id = g.id AND p.code = ?)`);
    params.push(platform);
  }
  // Prices arrive in DOLLARS from the UI, the database works in CENTS.
  const finalPriceSql = 'ROUND(g.price_cents * (100 - g.discount_percent) / 100.0)';
  if (minPrice !== undefined && minPrice !== '') {
    where.push(`${finalPriceSql} >= ?`);
    params.push(Math.round(Number(minPrice) * 100));
  }
  if (maxPrice !== undefined && maxPrice !== '') {
    where.push(`${finalPriceSql} <= ?`);
    params.push(Math.round(Number(maxPrice) * 100));
  }
  if (onSale === 'true') where.push('g.discount_percent > 0');
  if (inStock === 'true') where.push('g.stock > 0');

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = SORTS[sort] ?? SORTS.relevance;

  // Total count (for the paginator) uses the same filters.
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM games g ${whereSql}`).get(...params);

  const items = querySummaries(
    `${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`,
    ...params, limit, (page - 1) * limit,
  );

  res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
});

/** GET /api/games/home — several lists in one request for the landing page. */
gamesRouter.get('/home', (req, res) => {
  res.json({
    featured: querySummaries('WHERE g.featured = 1 ORDER BY g.metacritic DESC NULLS LAST'),
    onSale: querySummaries('WHERE g.discount_percent > 0 ORDER BY g.discount_percent DESC LIMIT 8'),
    newReleases: querySummaries('ORDER BY g.release_date DESC LIMIT 8'),
    topRated: querySummaries('WHERE g.metacritic IS NOT NULL ORDER BY g.metacritic DESC LIMIT 8'),
    freeToPlay: querySummaries('WHERE g.price_cents = 0 ORDER BY g.title'),
  });
});

/** GET /api/games/:slug — everything the product page needs. */
gamesRouter.get('/:slug', (req, res) => {
  const row = db.prepare(`${GAME_SUMMARY_SELECT} WHERE g.slug = ?`).get(req.params.slug);
  if (!row) throw new HttpError(404, 'Game not found');
  const game = toGameSummary(row);

  const extra = db
    .prepare('SELECT description, background_image, steam_app_id FROM games WHERE id = ?')
    .get(game.id);

  const media = db
    .prepare('SELECT type, url, thumbnail, title FROM game_media WHERE game_id = ? ORDER BY sort_order')
    .all(game.id);

  // How many reviews of each star value: { 5: 10, 4: 3, ... }
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  db.prepare('SELECT rating, COUNT(*) AS n FROM reviews WHERE game_id = ? GROUP BY rating')
    .all(game.id)
    .forEach((r) => (breakdown[r.rating] = r.n));

  // "You may also like": games sharing at least one genre, best rated first.
  const related = querySummaries(
    `WHERE g.id != ? AND EXISTS (
        SELECT 1 FROM game_genres a JOIN game_genres b ON a.genre_id = b.genre_id
         WHERE a.game_id = g.id AND b.game_id = ?)
     ORDER BY g.metacritic DESC NULLS LAST LIMIT 6`,
    game.id, game.id,
  );

  res.json({
    ...game,
    description: extra.description,
    backgroundImage: extra.background_image,
    steamUrl: `https://store.steampowered.com/app/${extra.steam_app_id}`,
    screenshots: media.filter((m) => m.type === 'screenshot').map((m) => m.url),
    trailers: media
      .filter((m) => m.type === 'trailer')
      .map((m) => ({ title: m.title, url: m.url, thumbnail: m.thumbnail })),
    ratingBreakdown: breakdown,
    related,
  });
});

/** GET /api/genres — includes how many games each genre has. */
catalogRouter.get('/genres', (req, res) => {
  res.json(
    db.prepare(`
      SELECT ge.id, ge.name, ge.slug, COUNT(gg.game_id) AS gameCount
        FROM genres ge LEFT JOIN game_genres gg ON gg.genre_id = ge.id
       GROUP BY ge.id ORDER BY ge.name
    `).all(),
  );
});

/** GET /api/platforms */
catalogRouter.get('/platforms', (req, res) => {
  res.json(db.prepare('SELECT id, code, name FROM platforms ORDER BY id').all());
});
