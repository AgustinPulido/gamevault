/**
 * admin.routes.js — back-office endpoints (role "admin" only).
 *
 *   GET   /api/admin/stats           dashboard numbers
 *   GET   /api/admin/games           every game (for the inventory table)
 *   PATCH /api/admin/games/:id       edit price / discount / stock / featured
 *   GET   /api/admin/orders          every order from every customer
 *   PATCH /api/admin/orders/:id      change order status
 */
import { Router } from 'express';
import { db } from '../db/database.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error-handler.js';
import { getGameSummaryById, querySummaries } from '../services/game.service.js';
import { parseId, validate } from '../utils/validate.js';
import { toIsoUtc } from '../utils/dates.js';

export const adminRouter = Router();
// Both middlewares run, in order, before every admin route.
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/stats', (req, res) => {
  // Cancelled/refunded orders don't count as revenue.
  const sales = db.prepare(`
    SELECT COUNT(*) AS orders, COALESCE(SUM(total_cents), 0) AS revenue
      FROM orders WHERE status NOT IN ('cancelled', 'refunded')
  `).get();

  const counts = db.prepare(`
    SELECT (SELECT COUNT(*) FROM users WHERE role = 'customer') AS customers,
           (SELECT COUNT(*) FROM games) AS games,
           (SELECT COUNT(*) FROM reviews) AS reviews
  `).get();

  // Best sellers: aggregate order lines per game.
  const topSellers = db.prepare(`
    SELECT oi.title, SUM(oi.quantity) AS unitsSold, SUM(oi.unit_price_cents * oi.quantity) AS revenue
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE o.status NOT IN ('cancelled', 'refunded')
     GROUP BY oi.title ORDER BY unitsSold DESC, revenue DESC LIMIT 5
  `).all();

  const lowStock = db.prepare(`
    SELECT id, title, stock FROM games WHERE stock < 5 ORDER BY stock, title
  `).all();

  res.json({ ...sales, ...counts, topSellers, lowStock });
});

adminRouter.get('/games', (req, res) => {
  res.json(querySummaries('ORDER BY g.title COLLATE NOCASE'));
});

adminRouter.patch('/games/:id', (req, res) => {
  const id = parseId(req.params.id);
  validate(req.body, {
    price: ['int', 'between:0-100000'],          // cents
    discountPercent: ['int', 'between:0-95'],
    stock: ['int', 'between:0-100000'],
  });
  const current = db.prepare('SELECT price_cents FROM games WHERE id = ?').get(id);
  if (!current) throw new HttpError(404, 'Game not found');

  // A discount on a free game makes no sense.
  const newPrice = req.body.price ?? current.price_cents;
  if (Number(newPrice) === 0 && Number(req.body.discountPercent) > 0) {
    throw new HttpError(400, 'Free games cannot have a discount');
  }

  // Only update the fields that were sent. COALESCE(?, column) keeps the
  // current value when the parameter is NULL.
  const b = req.body;
  const toInt = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
  db.prepare(`
    UPDATE games SET
      price_cents      = COALESCE(?, price_cents),
      discount_percent = COALESCE(?, discount_percent),
      stock            = COALESCE(?, stock),
      featured         = COALESCE(?, featured)
    WHERE id = ?
  `).run(
    toInt(b.price), toInt(b.discountPercent), toInt(b.stock),
    typeof b.featured === 'boolean' ? Number(b.featured) : null,
    id,
  );
  res.json(getGameSummaryById(id));
});

adminRouter.get('/orders', (req, res) => {
  res.json(
    db.prepare(`
      SELECT o.id, o.status, o.total_cents AS total, o.created_at AS createdAt,
             u.name AS customerName, u.email AS customerEmail,
             (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS itemCount
        FROM orders o JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC, o.id DESC
    `).all().map((o) => ({ ...o, createdAt: toIsoUtc(o.createdAt) })),
  );
});

adminRouter.patch('/orders/:id', (req, res) => {
  const id = parseId(req.params.id);
  const allowed = ['pending', 'paid', 'completed', 'cancelled', 'refunded'];
  if (!allowed.includes(req.body?.status)) {
    throw new HttpError(400, `status must be one of: ${allowed.join(', ')}`);
  }
  const { changes } = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(req.body.status, id);
  if (!changes) throw new HttpError(404, 'Order not found');
  res.json({ id, status: req.body.status });
});
