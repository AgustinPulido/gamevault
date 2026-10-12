/**
 * wishlist.routes.js — games the user wants to buy later.
 *
 *   GET    /api/wishlist           list of game cards
 *   POST   /api/wishlist/:gameId   add
 *   DELETE /api/wishlist/:gameId   remove
 */
import { Router } from 'express';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error-handler.js';
import { querySummaries } from '../services/game.service.js';
import { parseId } from '../utils/validate.js';

export const wishlistRouter = Router();
wishlistRouter.use(requireAuth);

const listFor = (userId) =>
  querySummaries(
    'JOIN wishlist w ON w.game_id = g.id WHERE w.user_id = ? ORDER BY w.added_at DESC',
    userId,
  );

wishlistRouter.get('/', (req, res) => res.json(listFor(req.user.id)));

wishlistRouter.post('/:gameId', (req, res) => {
  const gameId = parseId(req.params.gameId);
  if (!db.prepare('SELECT 1 FROM games WHERE id = ?').get(gameId)) {
    throw new HttpError(404, 'Game not found');
  }
  // "OR IGNORE": adding a game that is already in the list is not an error.
  db.prepare('INSERT OR IGNORE INTO wishlist (user_id, game_id) VALUES (?, ?)').run(req.user.id, gameId);
  res.status(201).json(listFor(req.user.id));
});

wishlistRouter.delete('/:gameId', (req, res) => {
  const gameId = parseId(req.params.gameId);
  db.prepare('DELETE FROM wishlist WHERE user_id = ? AND game_id = ?').run(req.user.id, gameId);
  res.json(listFor(req.user.id));
});
