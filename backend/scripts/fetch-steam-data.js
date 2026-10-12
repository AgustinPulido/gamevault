/**
 * fetch-steam-data.js
 * ---------------------------------------------------------------------------
 * ONE-TIME helper script that builds our mock catalog from REAL public data.
 *
 * Why? Mock data is much nicer when the images, screenshots and trailers
 * actually load. Steam exposes a public (no API key) endpoint:
 *
 *    https://store.steampowered.com/api/appdetails?appids=<id>
 *
 * which returns the name, description, prices, screenshots and trailer
 * streams of a game. We call it once per game and save the result to
 * `src/db/seed-data/games.json`. That JSON file is committed with the project,
 * so you DON'T need to run this script: the seed works offline.
 *
 * Run it only if you want to refresh/extend the catalog:
 *    npm run fetch-steam
 * ---------------------------------------------------------------------------
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Console platforms are not part of Steam's data (Steam is PC only), so we
// declare them by hand for each game. These are the "mock" part of the data.
const ALL = ['pc', 'ps5', 'xbox', 'switch'];
const GAMES = [
  { appId: 1245620, platforms: ['pc', 'ps5', 'xbox'], featured: true },  // Elden Ring
  { appId: 1091500, platforms: ALL, featured: true },                    // Cyberpunk 2077
  { appId: 292030, platforms: ALL },                                     // The Witcher 3
  { appId: 1174180, platforms: ['pc', 'ps5', 'xbox'], featured: true },  // Red Dead Redemption 2
  { appId: 271590, platforms: ['pc', 'ps5', 'xbox'] },                   // GTA V
  { appId: 367520, platforms: ALL },                                     // Hollow Knight
  { appId: 1145360, platforms: ALL },                                    // Hades
  { appId: 413150, platforms: ALL },                                     // Stardew Valley
  { appId: 620, platforms: ['pc', 'switch'] },                           // Portal 2
  { appId: 504230, platforms: ALL },                                     // Celeste
  { appId: 1086940, platforms: ['pc', 'ps5', 'xbox'], featured: true },  // Baldur's Gate 3
  { appId: 1593500, platforms: ['pc', 'ps5'] },                          // God of War
  { appId: 782330, platforms: ALL },                                     // DOOM Eternal
  { appId: 990080, platforms: ALL },                                     // Hogwarts Legacy
  { appId: 814380, platforms: ['pc', 'ps5', 'xbox'] },                   // Sekiro
  { appId: 105600, platforms: ALL },                                     // Terraria
  { appId: 374320, platforms: ['pc', 'ps5', 'xbox'] },                   // Dark Souls III
  { appId: 582010, platforms: ['pc', 'ps5', 'xbox'] },                   // Monster Hunter: World
  { appId: 2358720, platforms: ['pc', 'ps5', 'xbox'], featured: true },  // Black Myth: Wukong
  { appId: 1627720, platforms: ['pc', 'ps5', 'xbox'] },                  // Lies of P
  { appId: 2050650, platforms: ['pc', 'ps5', 'xbox'] },                  // Resident Evil 4
  { appId: 1551360, platforms: ['pc', 'ps5', 'xbox'] },                  // Forza Horizon 5
  { appId: 632470, platforms: ALL },                                     // Disco Elysium
  { appId: 1868140, platforms: ['pc', 'ps5', 'switch'] },                // Dave the Diver
  { appId: 553850, platforms: ['pc', 'ps5', 'xbox'] },                   // Helldivers 2
  { appId: 268910, platforms: ALL },                                     // Cuphead
  { appId: 264710, platforms: ALL },                                     // Subnautica
  { appId: 1426210, platforms: ALL },                                    // It Takes Two
  { appId: 1057090, platforms: ['pc', 'xbox', 'switch'] },               // Ori and the Will of the Wisps
  { appId: 1687950, platforms: ALL },                                    // Persona 5 Royal
  { appId: 1364780, platforms: ['pc', 'ps5', 'xbox'] },                  // Street Fighter 6
  { appId: 1145350, platforms: ['pc', 'switch'], featured: true },       // Hades II
  { appId: 730, platforms: ['pc'] },                                     // Counter-Strike 2
  { appId: 1172470, platforms: ALL },                                    // Apex Legends
  { appId: 2379780, platforms: ALL },                                    // Balatro
  { appId: 2246340, platforms: ['pc', 'ps5', 'xbox'] },                  // Monster Hunter Wilds
];

const OUTPUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/db/seed-data/games.json',
);

/** Small pause between requests so we are polite with Steam's rate limits. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Steam returns descriptions as HTML. We convert it to plain text with
 * paragraphs, because rendering third-party HTML is a security risk (XSS).
 */
function htmlToText(html = '') {
  return html
    .replace(/<h\d[^>]*>/gi, '\n\n')                     // headings start a new paragraph
    .replace(/<(br|\/p|\/h\d|\/li|\/ul)\s*\/?>/gi, '\n') // line-breaking tags -> \n
    .replace(/<li>/gi, '• ')                             // list items -> bullets
    .replace(/<[^>]+>/g, '')                             // drop every other tag
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')                        // collapse empty lines
    .trim();
}

/** Keep descriptions readable: cut at a paragraph boundary near `max` chars. */
function truncate(text, max = 1800) {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf('\n', max);
  return text.slice(0, cut > 400 ? cut : max).trim();
}

/** Turns "ELDEN RING" into "elden-ring" (used for pretty URLs). */
function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Steam dates look like "24 Feb, 2022" -> we store ISO "2022-02-24". */
function toIsoDate(steamDate) {
  const d = new Date(steamDate);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** HEAD request to know whether an image URL exists. */
async function exists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchGame({ appId, platforms, featured = false }) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=english`;
  const json = await (await fetch(url)).json();
  const entry = json[appId];
  if (!entry?.success) throw new Error(`Steam returned no data for ${appId}`);
  const d = entry.data;

  // Vertical "box art" cover. Not every game has one, so we verify it.
  const cdn = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}`;
  const portrait = `${cdn}/library_600x900_2x.jpg`;
  const coverImage = (await exists(portrait)) ? portrait : d.header_image;

  // Some paid games have no price on Steam (e.g. only sold in bundles).
  // In that case we invent a mock price so they can still be bought here.
  const price = d.is_free ? 0 : (d.price_overview?.initial ?? 2999) / 100;
  const discount = d.price_overview?.discount_percent ?? 0;

  return {
    steamAppId: appId,
    title: d.name.replace(/[™®]/g, ''), // "SEKIRO™" -> "SEKIRO"
    slug: slugify(d.name),
    shortDescription: htmlToText(d.short_description),
    description: truncate(htmlToText(d.about_the_game)),
    developer: d.developers?.[0] ?? 'Unknown',
    publisher: d.publishers?.[0] ?? 'Unknown',
    releaseDate: toIsoDate(d.release_date?.date),
    ageRating: Number(d.required_age) || 0,
    metacritic: d.metacritic?.score ?? null,
    price,
    discountPercent: discount,
    coverImage,
    headerImage: d.header_image,
    backgroundImage: d.background_raw ?? d.background ?? d.header_image,
    featured,
    genres: (d.genres ?? []).map((g) => g.description),
    platforms,
    screenshots: (d.screenshots ?? []).slice(0, 6).map((s) => s.path_full),
    // Steam trailers are HLS streams (.m3u8). The frontend plays them with hls.js.
    trailers: (d.movies ?? []).slice(0, 3).map((m) => ({
      title: m.name,
      thumbnail: m.thumbnail,
      url: m.hls_h264,
    })).filter((t) => t.url),
  };
}

async function main() {
  const games = [];
  for (const g of GAMES) {
    try {
      const game = await fetchGame(g);
      games.push(game);
      console.log(`✔ ${game.title} (${game.trailers.length} trailers, ${game.screenshots.length} screenshots)`);
    } catch (err) {
      console.warn(`✘ ${g.appId}: ${err.message}`);
    }
    await sleep(400);
  }
  await writeFile(OUTPUT, JSON.stringify(games, null, 2));
  console.log(`\nSaved ${games.length} games to ${OUTPUT}`);
}

main();
