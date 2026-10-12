/**
 * server.js — ENTRY POINT of the backend (`npm start` / `npm run dev`).
 * 1. Makes sure the database exists and has data (seeds it the first time).
 * 2. Starts listening for HTTP requests.
 */
import { app } from './app.js';
import { config } from './config.js';
import { isSeeded } from './db/database.js';
import { seedDatabase } from './db/seed.js';

if (!isSeeded()) {
  console.log('Database is empty, loading mock data...');
  seedDatabase();
}

app.listen(config.port, () => {
  console.log(`🎮 GameVault API running at http://localhost:${config.port}/api`);
});
