/**
 * dates.js
 * SQLite's datetime('now') produces "2026-10-12 21:03:46" (UTC, but WITHOUT a
 * timezone marker). Browsers would read that as LOCAL time, showing wrong hours.
 * We convert it to ISO 8601 with "Z" (= UTC): "2026-10-12T21:03:46Z".
 */
export const toIsoUtc = (sqliteDate) => (sqliteDate ? sqliteDate.replace(' ', 'T') + 'Z' : null);
