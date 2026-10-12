/**
 * validate.js — tiny input validation helpers.
 * ---------------------------------------------------------------------------
 * NEVER trust data coming from the client: anyone can send any JSON to the
 * API with tools like curl or Postman, bypassing the Angular form checks.
 * So the backend validates everything again.
 *
 * (In bigger projects a library such as zod or joi is common. We keep it
 *  dependency-free here so it's easy to read.)
 * ---------------------------------------------------------------------------
 */
import { HttpError } from '../middleware/error-handler.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates `body` against simple rules and throws a 400 error listing every
 * problem found. Example:
 *   validate(req.body, { email: ['required', 'email'], password: ['required', 'min:6'] })
 */
export function validate(body, rules) {
  const errors = {};
  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = body?.[field];
    for (const rule of fieldRules) {
      const [name, arg] = rule.split(':');
      const empty = value === undefined || value === null || String(value).trim() === '';
      let error = null;

      if (name === 'required' && empty) error = 'is required';
      else if (empty) continue; // other rules only apply when a value exists
      else if (name === 'email' && !EMAIL_RE.test(value)) error = 'must be a valid email';
      else if (name === 'min' && String(value).trim().length < Number(arg)) error = `must have at least ${arg} characters`;
      else if (name === 'max' && String(value).length > Number(arg)) error = `must have at most ${arg} characters`;
      else if (name === 'int' && !Number.isInteger(Number(value))) error = 'must be an integer';
      else if (name === 'between') {
        const [lo, hi] = arg.split('-').map(Number);
        if (!(Number(value) >= lo && Number(value) <= hi)) error = `must be between ${lo} and ${hi}`;
      }

      if (error) {
        errors[field] = `${field} ${error}`;
        break; // one message per field is enough
      }
    }
  }
  if (Object.keys(errors).length) {
    throw new HttpError(400, Object.values(errors)[0], errors);
  }
}

/** Parses a positive integer from a route param, or throws 400. */
export function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id');
  return id;
}
