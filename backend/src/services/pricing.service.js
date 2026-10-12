/**
 * pricing.service.js
 * ---------------------------------------------------------------------------
 * The ONLY place where cart totals are calculated. The cart page, the coupon
 * check and the checkout all call this, so the numbers always match.
 *
 * Golden rule of e-commerce: the SERVER calculates prices. Never trust a total
 * sent by the browser — a user could edit it with the DevTools.
 * ---------------------------------------------------------------------------
 */
import { db } from '../db/database.js';
import { config } from '../config.js';
import { HttpError } from '../middleware/error-handler.js';

/**
 * Looks up an active coupon and checks it can be applied to `subtotalCents`.
 * Throws a 400 error with a friendly message when it can't.
 */
export function findValidCoupon(code, subtotalCents) {
  const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(code.trim());
  if (!coupon) throw new HttpError(400, 'Invalid or expired coupon code');
  if (subtotalCents < coupon.min_order_cents) {
    throw new HttpError(
      400,
      `This coupon requires a minimum order of $${(coupon.min_order_cents / 100).toFixed(2)}`,
    );
  }
  return coupon;
}

/**
 * Calculates every total from the list of cart lines.
 * @param lines   array of { unitPrice, originalUnitPrice, quantity } in cents
 * @param coupon  optional coupon row (from findValidCoupon)
 */
export function calculateTotals(lines, coupon = null) {
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  // How much the per-game discounts saved (shown as "You save $X").
  const savings = lines.reduce((sum, l) => sum + (l.originalUnitPrice - l.unitPrice) * l.quantity, 0);
  const discount = coupon ? Math.round((subtotal * coupon.percent_off) / 100) : 0;
  const tax = Math.round((subtotal - discount) * config.taxRate);
  const total = subtotal - discount + tax;

  return {
    itemCount,
    subtotal,
    savings,
    coupon: coupon
      ? { code: coupon.code, description: coupon.description, percentOff: coupon.percent_off }
      : null,
    discount,
    taxRate: config.taxRate,
    tax,
    total,
  };
}
