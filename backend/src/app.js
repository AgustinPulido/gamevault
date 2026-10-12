/**
 * app.js — builds the Express application (middlewares + routes).
 * ---------------------------------------------------------------------------
 * A request flows top to bottom through this file:
 *
 *   request -> cors -> json parser -> logger -> matching router -> response
 *                                                     \-> (error) -> errorHandler
 *
 * The server is started in server.js. Keeping "build the app" separate from
 * "listen on a port" makes the app easy to test.
 * ---------------------------------------------------------------------------
 */
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { authRouter } from './routes/auth.routes.js';
import { catalogRouter, gamesRouter } from './routes/games.routes.js';
import { reviewsRouter } from './routes/reviews.routes.js';
import { cartRouter } from './routes/cart.routes.js';
import { wishlistRouter } from './routes/wishlist.routes.js';
import { couponsRouter, ordersRouter } from './routes/orders.routes.js';
import { adminRouter } from './routes/admin.routes.js';

export const app = express();

// CORS: browsers block requests between different origins
// (localhost:4200 -> localhost:3000) unless the server allows it.
app.use(cors({ origin: config.corsOrigin }));

// Parses JSON request bodies into req.body.
app.use(express.json({ limit: '100kb' }));

// Minimal request logger: "GET /api/games 200 - 4ms".
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${Date.now() - start}ms`));
  next();
});

// Health check: handy to know if the API is up.
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Mount each router under its base path.
app.use('/api/auth', authRouter);
app.use('/api/games', gamesRouter);
app.use('/api', catalogRouter);   // /api/genres, /api/platforms
app.use('/api', reviewsRouter);   // /api/games/:id/reviews, /api/reviews/:id
app.use('/api/cart', cartRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/admin', adminRouter);

// These two must be LAST: unmatched routes, then errors.
app.use(notFound);
app.use(errorHandler);
