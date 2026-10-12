/**
 * error-handler.js
 * ---------------------------------------------------------------------------
 * In Express, a "middleware" is a function (req, res, next) that runs during
 * a request. ERROR middlewares have 4 arguments (err, req, res, next) and
 * Express calls them whenever a route throws an error.
 *
 * Express 5 automatically catches errors thrown inside async route handlers,
 * so our routes can simply `throw new HttpError(404, 'Not found')`.
 * ---------------------------------------------------------------------------
 */

/** An Error that carries an HTTP status code (400, 401, 404...). */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details; // optional extra info, e.g. validation errors
  }
}

/** Handles requests to URLs that don't match any route. */
export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

/** Turns any thrown error into a consistent JSON response. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Errors we threw on purpose have a status; anything else is a bug -> 500.
  const status = err.status ?? 500;

  // SQLite constraint violations (e.g. duplicated UNIQUE value) -> 409 Conflict.
  if (err.code === 'ERR_SQLITE_ERROR' && /constraint/i.test(err.message)) {
    return res.status(409).json({ message: 'Conflict: ' + err.message });
  }

  if (status === 500) console.error(err); // log unexpected errors for debugging
  res.status(status).json({
    message: status === 500 ? 'Internal server error' : err.message,
    ...(err.details && { details: err.details }),
  });
}
