/**
 * orders.routes.js — checkout and order history.
 *
 *   POST /api/orders          turn the cart into a paid order (mock payment)
 *   GET  /api/orders          my orders
 *   GET  /api/orders/:id      one of my orders, with activation keys
 *   GET  /api/coupons/:code   check a coupon (used by the cart page)
 *
 * PAYMENTS ARE FAKE. No real card is charged. Test cards:
 *   4242 4242 4242 4242  -> approved
 *   4000 0000 0000 0002  -> declined (to test the error flow)
 */
import { Router } from 'express';
import { db, transaction } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error-handler.js';
import { calculateTotals, findValidCoupon } from '../services/pricing.service.js';
import { generateActivationKey } from '../utils/keys.js';
import { parseId, validate } from '../utils/validate.js';
import { toIsoUtc } from '../utils/dates.js';
import { getCartLines } from './cart.routes.js';

export const ordersRouter = Router();
export const couponsRouter = Router();

/**
 * Luhn algorithm: the checksum every real card number satisfies.
 * It catches typos (a wrong digit) without contacting any bank.
 */
function isValidLuhn(cardNumber) {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Converts DB rows into the Order JSON (with its items). */
function loadOrder(orderId, userId) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId);
  if (!o) return null;
  // LEFT JOIN: keep the line even if the game was deleted (slug will be null).
  const items = db
    .prepare('SELECT oi.*, g.slug FROM order_items oi LEFT JOIN games g ON g.id = oi.game_id WHERE oi.order_id = ?')
    .all(orderId);
  return {
    id: o.id,
    status: o.status,
    createdAt: toIsoUtc(o.created_at),
    subtotal: o.subtotal_cents,
    couponCode: o.coupon_code,
    discount: o.discount_cents,
    tax: o.tax_cents,
    total: o.total_cents,
    billing: {
      name: o.billing_name,
      email: o.billing_email,
      address: o.billing_address,
      city: o.billing_city,
      country: o.billing_country,
    },
    payment: { method: o.payment_method, last4: o.payment_last4 },
    items: items.map((i) => ({
      id: i.id,
      gameId: i.game_id,
      slug: i.slug,
      title: i.title,
      coverImage: i.cover_image,
      platformName: i.platform_name,
      unitPrice: i.unit_price_cents,
      quantity: i.quantity,
      activationKeys: JSON.parse(i.activation_keys),
    })),
  };
}

// ---------------------------------------------------------------------------
// CHECKOUT
// ---------------------------------------------------------------------------
ordersRouter.post('/', requireAuth, (req, res) => {
  const { billing = {}, payment = {}, couponCode } = req.body ?? {};
  validate(billing, {
    name: ['required', 'min:2', 'max:100'],
    email: ['required', 'email'],
    address: ['required', 'min:3', 'max:200'],
    city: ['required', 'max:100'],
    country: ['required', 'max:100'],
  });
  validate(payment, {
    cardNumber: ['required'],
    expiry: ['required'],
    cvc: ['required', 'min:3', 'max:4'],
  });

  // --- 1. Validate the (fake) card --------------------------------------------
  const cardNumber = String(payment.cardNumber).replace(/\s/g, '');
  if (!isValidLuhn(cardNumber)) throw new HttpError(400, 'Invalid card number');

  const [mm, yy] = String(payment.expiry).split('/').map(Number);
  const now = new Date();
  // new Date(year, month, 1) with a 1-based month = first day of the NEXT month.
  const expiresAt = new Date(2000 + yy, mm, 1);
  if (!(mm >= 1 && mm <= 12) || expiresAt <= now) throw new HttpError(400, 'Card is expired or expiry date is invalid');

  if (cardNumber === '4000000000000002') {
    throw new HttpError(402, 'Payment declined by the bank (test card)'); // 402 = Payment Required
  }

  // --- 2. Everything else happens in ONE transaction ----------------------
  // If anything fails midway (e.g. stock ran out), nothing is saved.
  const orderId = transaction(() => {
    const lines = getCartLines(req.user.id);
    if (lines.length === 0) throw new HttpError(400, 'Your cart is empty');

    const subtotal = calculateTotals(lines).subtotal;
    const coupon = couponCode ? findValidCoupon(couponCode, subtotal) : null;
    const totals = calculateTotals(lines, coupon);

    const { lastInsertRowid } = db.prepare(`
      INSERT INTO orders (user_id, status, subtotal_cents, coupon_code, discount_cents, tax_cents,
        total_cents, billing_name, billing_email, billing_address, billing_city, billing_country,
        payment_method, payment_last4)
      VALUES (?, 'paid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'card', ?)
    `).run(
      req.user.id, totals.subtotal, coupon?.code ?? null, totals.discount, totals.tax, totals.total,
      billing.name.trim(), billing.email.trim(), billing.address.trim(), billing.city.trim(),
      billing.country.trim(), cardNumber.slice(-4), // keep only the last 4 digits!
    );
    const newOrderId = Number(lastInsertRowid);

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, game_id, platform_name, title, cover_image,
        unit_price_cents, quantity, activation_keys)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    // The "AND stock >= ?" guard makes the decrement atomic: two customers
    // buying the last copy at the same time can't both succeed.
    const decrementStock = db.prepare('UPDATE games SET stock = stock - ? WHERE id = ? AND stock >= ?');

    for (const line of lines) {
      const { changes } = decrementStock.run(line.quantity, line.game.id, line.quantity);
      if (!changes) {
        throw new HttpError(409, `Not enough stock for "${line.game.title}" (only ${line.game.stock} left)`);
      }
      const keys = Array.from({ length: line.quantity }, generateActivationKey);
      insertItem.run(
        newOrderId, line.game.id, line.platform.name, line.game.title, line.game.coverImage,
        line.unitPrice, line.quantity, JSON.stringify(keys),
      );
    }

    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
    return newOrderId;
  });

  res.status(201).json(loadOrder(orderId, req.user.id));
});

// ---------------------------------------------------------------------------
// ORDER HISTORY
// ---------------------------------------------------------------------------
ordersRouter.get('/', requireAuth, (req, res) => {
  const ids = db
    .prepare('SELECT id FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC')
    .all(req.user.id);
  res.json(ids.map(({ id }) => loadOrder(id, req.user.id)));
});

ordersRouter.get('/:id', requireAuth, (req, res) => {
  const order = loadOrder(parseId(req.params.id), req.user.id);
  if (!order) throw new HttpError(404, 'Order not found');
  res.json(order);
});

// ---------------------------------------------------------------------------
// COUPONS
// ---------------------------------------------------------------------------
couponsRouter.get('/:code', (req, res) => {
  const subtotal = Number(req.query.subtotal) || 0; // in cents
  const c = findValidCoupon(req.params.code, subtotal);
  res.json({ code: c.code, description: c.description, percentOff: c.percent_off });
});
