/**
 * game.service.js
 * ---------------------------------------------------------------------------
 * Reusable database queries for games. Several routes (catalog, cart,
 * wishlist, admin) need the same "game card" information, so we build that
 * SQL in ONE place instead of copy-pasting it.
 *
 * It also converts database rows (snake_case, flat) into the JSON shape the
 * frontend expects (camelCase, nested). Keeping this "mapping" in one spot
 * means the DB and the API can evolve independently.
 * ---------------------------------------------------------------------------
 */
import { db } from '../db/database.js';

/** Price after the percentage discount, in cents (rounded). */
export const finalPrice = (priceCents, discountPercent) =>
  Math.round((priceCents * (100 - discountPercent)) / 100);

/**
 * Base SELECT for game cards. Subqueries add data from related tables:
 *  - json_group_array/json_object build a JSON array string inside SQLite,
 *    e.g. '[{"id":1,"code":"pc","name":"PC"}]', which we JSON.parse later.
 *  - AVG/COUNT compute the review summary.
 *  - final_price_cents is computed here so we can SORT and FILTER by it.
 */
export const GAME_SUMMARY_SELECT = `
  SELECT
    g.id, g.slug, g.title, g.short_description, g.developer, g.publisher,
    g.release_date, g.age_rating, g.metacritic, g.price_cents, g.discount_percent,
    g.stock, g.cover_image, g.header_image, g.featured,
    CAST(ROUND(g.price_cents * (100 - g.discount_percent) / 100.0) AS INTEGER) AS final_price_cents,
    (SELECT json_group_array(json_object('id', ge.id, 'name', ge.name, 'slug', ge.slug))
       FROM game_genres gg JOIN genres ge ON ge.id = gg.genre_id
      WHERE gg.game_id = g.id) AS genres_json,
    (SELECT json_group_array(json_object('id', p.id, 'code', p.code, 'name', p.name))
       FROM game_platforms gp JOIN platforms p ON p.id = gp.platform_id
      WHERE gp.game_id = g.id) AS platforms_json,
    (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.game_id = g.id) AS avg_rating,
    (SELECT COUNT(*) FROM reviews r WHERE r.game_id = g.id) AS review_count
  FROM games g
`;

/** Converts a row from GAME_SUMMARY_SELECT into the API's "GameSummary" JSON. */
export function toGameSummary(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description,
    developer: row.developer,
    publisher: row.publisher,
    releaseDate: row.release_date,
    ageRating: row.age_rating,
    metacritic: row.metacritic,
    price: row.price_cents,               // all prices are in CENTS
    discountPercent: row.discount_percent,
    finalPrice: row.final_price_cents,
    stock: row.stock,
    coverImage: row.cover_image,
    headerImage: row.header_image,
    featured: row.featured === 1,         // SQLite 0/1 -> real boolean
    genres: JSON.parse(row.genres_json ?? '[]'),
    platforms: JSON.parse(row.platforms_json ?? '[]'),
    rating: row.avg_rating ?? 0,
    reviewCount: row.review_count,
  };
}

/** Fetches one game card by id (or undefined). */
export function getGameSummaryById(id) {
  const row = db.prepare(`${GAME_SUMMARY_SELECT} WHERE g.id = ?`).get(id);
  return row && toGameSummary(row);
}

/** Runs GAME_SUMMARY_SELECT with an extra SQL tail (WHERE/ORDER/LIMIT) and params. */
export function querySummaries(tailSql, ...params) {
  return db.prepare(`${GAME_SUMMARY_SELECT} ${tailSql}`).all(...params).map(toGameSummary);
}
