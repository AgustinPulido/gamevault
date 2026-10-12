/**
 * reviews.routes.js — players' opinions about a game.
 *
 *   GET    /api/games/:gameId/reviews   list (public)
 *   POST   /api/games/:gameId/reviews   create (logged in, one per game)
 *   DELETE /api/reviews/:id             delete (author or admin)
 */
import { Router } from 'express';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error-handler.js';
import { parseId, validate } from '../utils/validate.js';
import { toIsoUtc } from '../utils/dates.js';

export const reviewsRouter = Router();

// JOIN users to show the author's name and avatar next to each review.
const REVIEW_SELECT = `
  SELECT r.id, r.game_id AS gameId, r.rating, r.title, r.body, r.created_at AS createdAt,
         u.id AS userId, u.name AS userName, u.avatar_url AS userAvatar,
         -- Did the author buy the game? (shown as a "Verified purchase" badge)
         EXISTS (SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
                  WHERE o.user_id = u.id AND oi.game_id = r.game_id) AS verifiedPurchase
    FROM reviews r JOIN users u ON u.id = r.user_id
`;

/** Converts 0/1 into a real boolean and the date into ISO format. */
const mapReview = (r) => ({ ...r, createdAt: toIsoUtc(r.createdAt), verifiedPurchase: r.verifiedPurchase === 1 });

reviewsRouter.get('/games/:gameId/reviews', (req, res) => {
  const gameId = parseId(req.params.gameId);
  const order = req.query.sort === 'rating' ? 'r.rating DESC, r.created_at DESC' : 'r.created_at DESC';
  res.json(db.prepare(`${REVIEW_SELECT} WHERE r.game_id = ? ORDER BY ${order}`).all(gameId).map(mapReview));
});

reviewsRouter.post('/games/:gameId/reviews', requireAuth, (req, res) => {
  const gameId = parseId(req.params.gameId);
  validate(req.body, {
    rating: ['required', 'int', 'between:1-5'],
    title: ['required', 'min:3', 'max:80'],
    body: ['required', 'min:10', 'max:2000'],
  });

  if (!db.prepare('SELECT 1 FROM games WHERE id = ?').get(gameId)) {
    throw new HttpError(404, 'Game not found');
  }
  const already = db.prepare('SELECT 1 FROM reviews WHERE game_id = ? AND user_id = ?').get(gameId, req.user.id);
  if (already) throw new HttpError(409, 'You have already reviewed this game');

  const { lastInsertRowid } = db
    .prepare('INSERT INTO reviews (game_id, user_id, rating, title, body) VALUES (?, ?, ?, ?, ?)')
    .run(gameId, req.user.id, Number(req.body.rating), req.body.title.trim(), req.body.body.trim());

  res.status(201).json(mapReview(db.prepare(`${REVIEW_SELECT} WHERE r.id = ?`).get(lastInsertRowid)));
});

reviewsRouter.delete('/reviews/:id', requireAuth, (req, res) => {
  const id = parseId(req.params.id);
  const review = db.prepare('SELECT user_id FROM reviews WHERE id = ?').get(id);
  if (!review) throw new HttpError(404, 'Review not found');
  // Only the author or an admin may delete it.
  if (review.user_id !== req.user.id && req.user.role !== 'admin') {
    throw new HttpError(403, 'You can only delete your own reviews');
  }
  db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
  res.status(204).end(); // 204 = success, no content
});
