/**
 * cart.routes.js — the logged-in user's shopping cart.
 * Every endpoint returns the WHOLE updated cart, so the frontend can just
 * replace its state with the response (simple and always in sync).
 *
 *   GET    /api/cart                 view cart (+ ?coupon=CODE to preview a discount)
 *   POST   /api/cart                 { gameId, platformId, quantity } add a game
 *   PATCH  /api/cart/:itemId         { quantity } change quantity
 *   DELETE /api/cart/:itemId         remove one line
 *   DELETE /api/cart                 empty the cart
 */
import { Router } from 'express';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error-handler.js';
import { getGameSummaryById } from '../services/game.service.js';
import { calculateTotals, findValidCoupon } from '../services/pricing.service.js';
import { parseId, validate } from '../utils/validate.js';

export const cartRouter = Router();
cartRouter.use(requireAuth); // every cart route needs a logged-in user

/** Reads the cart lines of a user with full game info. Exported for checkout. */
export function getCartLines(userId) {
  const rows = db
    .prepare(`
      SELECT ci.id, ci.game_id, ci.quantity, p.id AS platform_id, p.code, p.name AS platform_name
        FROM cart_items ci JOIN platforms p ON p.id = ci.platform_id
       WHERE ci.user_id = ? ORDER BY ci.added_at
    `)
    .all(userId);

  return rows.map((r) => {
    const game = getGameSummaryById(r.game_id);
    return {
      id: r.id,
      quantity: r.quantity,
      platform: { id: r.platform_id, code: r.code, name: r.platform_name },
      game,
      unitPrice: game.finalPrice,
      originalUnitPrice: game.price,
      lineTotal: game.finalPrice * r.quantity,
    };
  });
}

/** Builds the response: lines + totals (optionally with a coupon applied). */
function buildCart(userId, couponCode) {
  const items = getCartLines(userId);
  let coupon = null;
  let couponError = null;
  if (couponCode) {
    try {
      coupon = findValidCoupon(couponCode, calculateTotals(items).subtotal);
    } catch (err) {
      couponError = err.message; // show the problem but still return the cart
    }
  }
  return { items, totals: calculateTotals(items, coupon), couponError };
}

cartRouter.get('/', (req, res) => {
  res.json(buildCart(req.user.id, req.query.coupon));
});

cartRouter.post('/', (req, res) => {
  validate(req.body, {
    gameId: ['required', 'int'],
    platformId: ['required', 'int'],
    quantity: ['int', 'between:1-10'],
  });
  const gameId = Number(req.body.gameId);
  const platformId = Number(req.body.platformId);
  const quantity = Number(req.body.quantity ?? 1);

  const game = db.prepare('SELECT stock FROM games WHERE id = ?').get(gameId);
  if (!game) throw new HttpError(404, 'Game not found');
  if (game.stock < 1) throw new HttpError(400, 'This game is out of stock');

  // Is the game actually available on that platform?
  const available = db
    .prepare('SELECT 1 FROM game_platforms WHERE game_id = ? AND platform_id = ?')
    .get(gameId, platformId);
  if (!available) throw new HttpError(400, 'Game not available on that platform');

  // UPSERT: insert a new line, or if (user, game, platform) already exists,
  // add to its quantity (max 10). Handled by SQLite in one statement.
  db.prepare(`
    INSERT INTO cart_items (user_id, game_id, platform_id, quantity) VALUES (?, ?, ?, ?)
    ON CONFLICT (user_id, game_id, platform_id)
    DO UPDATE SET quantity = MIN(10, quantity + excluded.quantity)
  `).run(req.user.id, gameId, platformId, quantity);

  res.status(201).json(buildCart(req.user.id));
});

cartRouter.patch('/:itemId', (req, res) => {
  const itemId = parseId(req.params.itemId);
  validate(req.body, { quantity: ['required', 'int', 'between:1-10'] });

  // "AND user_id = ?" makes sure users can only modify THEIR OWN cart.
  const { changes } = db
    .prepare('UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?')
    .run(Number(req.body.quantity), itemId, req.user.id);
  if (!changes) throw new HttpError(404, 'Cart item not found');

  res.json(buildCart(req.user.id));
});

cartRouter.delete('/:itemId', (req, res) => {
  const itemId = parseId(req.params.itemId);
  db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(itemId, req.user.id);
  res.json(buildCart(req.user.id));
});

cartRouter.delete('/', (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
  res.json(buildCart(req.user.id));
});
