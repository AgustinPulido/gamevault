# 🎮 GameVault: Video Game E-commerce

A complete demo store for video games, built to learn from. Every file has comments explaining what it does and why.

| Layer    | Tech |
|----------|------|
| Frontend | **Angular 22**: standalone components, signals, zoneless, `httpResource`, Signal Forms, lazy routes |
| Backend  | **Node.js 24 + Express 5**: REST API, JWT auth, bcrypt |
| Database | **SQLite** (relational) via Node's built-in `node:sqlite`, so there's nothing to install |
| Data     | 36 real games (images, screenshots and HLS trailers from Steam's public CDN) plus mock users, reviews, coupons and orders |

---

## 1. Requirements

Angular 22 needs **Node ≥ 22.22**. Node **24.21.0** was installed for you with `nvm`. Activate it in each new terminal:

```powershell
nvm use 24.21.0
node -v   # v24.21.0
```

## 2. Run it (two terminals)

```powershell
# Terminal 1: API on http://localhost:3000
cd backend
npm install
npm run dev        # creates + seeds the database automatically the first time

# Terminal 2: website on http://localhost:4200
cd frontend
npm install
npm start
```

Open **http://localhost:4200**.

### Demo accounts and test data

| What | Value |
|------|-------|
| Customer | `demo@gamevault.dev` / `demo123` |
| Admin | `admin@gamevault.dev` / `admin123` |
| Approved card | `4242 4242 4242 4242`, any future expiry (e.g. `12/30`), any CVC |
| Declined card | `4000 0000 0000 0002` |
| Coupons | `WELCOME10` (10%), `GAMER20` (20% over $50), `MEGA50` (50% over $150) |

Reset the database to its initial state at any time with `npm run seed` (inside `backend/`).

---

## 3. Features

- **Store home**: auto-rotating featured carousel, genres, deals, new releases, top rated, free-to-play.
- **Catalog**: search, filter by genre, platform, price, on sale or in stock; 8 sort orders; pagination. All filters live in the URL, so a search can be bookmarked or shared.
- **Game page**: trailer player (HLS streaming with `hls.js`), screenshot gallery, platform picker, quantity, stock warnings, wishlist, rating breakdown, reviews (create/delete), related games.
- **Cart**: stored in the database per user; quantities, coupons, discounts, tax.
- **Checkout**: validated billing and card forms (Luhn check), mock payment, stock decremented inside a DB **transaction**, activation keys generated.
- **Orders**: history and receipt with copy-to-clipboard keys.
- **Auth**: register/login with JWT, route guards, auto-logout on expired token.
- **Admin panel**: KPIs, best sellers, low stock, inventory editing (price/discount/stock/featured), order status management.
- Responsive (mobile → desktop), dark theme, skeleton loaders, toasts, 404 page.

---

## 4. Project structure

```
Ecommerce/
├── backend/
│   ├── scripts/fetch-steam-data.js   # (optional) re-downloads real game data from Steam
│   └── src/
│       ├── server.js                 # ENTRY POINT: seeds DB if empty, starts the server
│       ├── app.js                    # Express app: middlewares + routes
│       ├── config.js                 # port, JWT secret, tax rate...
│       ├── db/
│       │   ├── schema.sql            # ⭐ the relational model (tables, FKs, indexes)
│       │   ├── database.js           # SQLite connection + transaction helper
│       │   ├── seed.js               # mock data generator
│       │   └── seed-data/games.json  # 36 games fetched from Steam
│       ├── middleware/               # auth (JWT) + error handling
│       ├── services/                 # reusable logic: game queries, pricing
│       ├── routes/                   # one file per resource (games, cart, orders...)
│       └── utils/                    # validation, keys, dates
│
└── frontend/
    ├── proxy.conf.json               # dev: forwards /api/* to localhost:3000
    └── src/
        ├── index.html / styles.scss  # fonts, icons, global design tokens
        └── app/
            ├── app.config.ts         # providers: router, HttpClient, interceptor
            ├── app.routes.ts         # URL → page (lazy loaded) + guards
            ├── core/                 # models, services (state), interceptor, guards
            ├── shared/               # reusable UI: game card, price tag, stars, trailer player, pipe
            ├── layout/               # header + footer
            └── pages/                # one folder per page
```

### Database diagram

```
users ─┬─< orders ─< order_items >─ games ─┬─< game_media      (screenshots, trailers)
       ├─< reviews >──────────────────────┤
       ├─< cart_items >───────────────────┤─< game_genres >─ genres
       └─< wishlist >─────────────────────┘─< game_platforms >─ platforms
coupons (standalone)
```

Money is stored as **integer cents** (`5999` = $59.99) to avoid floating-point rounding errors.

To inspect the database, open `backend/data/gamevault.db` with the *SQLite Viewer* VS Code extension or *DB Browser for SQLite*.

---

## 5. API reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | – | Create account → `{ token, user }` |
| POST | `/api/auth/login` | – | Login → `{ token, user }` |
| GET | `/api/auth/me` | ✔ | Current user |
| GET | `/api/games` | – | List with `q, genre, platform, minPrice, maxPrice, onSale, inStock, sort, page, limit` |
| GET | `/api/games/home` | – | Home page sections |
| GET | `/api/games/:slug` | – | Game detail (media, rating breakdown, related) |
| GET | `/api/genres`, `/api/platforms` | – | Lookup lists |
| GET/POST | `/api/games/:id/reviews` | POST ✔ | List / create reviews |
| DELETE | `/api/reviews/:id` | ✔ | Delete own review (or any, as admin) |
| GET/POST/DELETE | `/api/cart` | ✔ | View (`?coupon=`), add, empty |
| PATCH/DELETE | `/api/cart/:itemId` | ✔ | Change quantity / remove line |
| GET/POST/DELETE | `/api/wishlist[/:gameId]` | ✔ | Wishlist |
| GET | `/api/coupons/:code` | – | Validate a coupon |
| POST | `/api/orders` | ✔ | Checkout (mock payment) |
| GET | `/api/orders[/:id]` | ✔ | Order history / detail |
| GET | `/api/admin/stats` | admin | Dashboard |
| GET/PATCH | `/api/admin/games[/:id]` | admin | Inventory |
| GET/PATCH | `/api/admin/orders[/:id]` | admin | Orders + status |

Quick test: `curl http://localhost:3000/api/games?genre=rpg&sort=price_asc`

---

## 6. Suggested reading order

1. `backend/src/db/schema.sql`: the data model.
2. `backend/src/app.js`, then `routes/games.routes.js` and `routes/orders.routes.js` (the checkout transaction).
3. `frontend/src/app/app.config.ts` and `app.routes.ts`.
4. `core/services/cart.service.ts`: shared state with signals.
5. `pages/catalog/catalog.ts`: `httpResource` + URL-driven filters.
6. `pages/checkout/checkout.ts`: Signal Forms with custom and server-side validation.

---

> ⚠️ Educational project. Game names, images and trailers belong to their respective owners and are loaded from Steam's public CDN. No real payments are processed.
