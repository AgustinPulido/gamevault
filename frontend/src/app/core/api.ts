/**
 * api.ts — base URL of the backend + a helper to read error messages.
 *
 * We use a RELATIVE url ("/api"). During development, `ng serve` forwards
 * every /api/* request to http://localhost:3000 (see proxy.conf.json), so
 * the browser thinks it's the same origin and no CORS setup is needed.
 */
import { HttpErrorResponse } from '@angular/common/http';

export const API_URL = '/api';

/** Extracts a human readable message from any HTTP error. */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Cannot reach the server. Is the backend running?';
    return err.error?.message ?? err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}
