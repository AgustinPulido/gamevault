/**
 * models.ts
 * ---------------------------------------------------------------------------
 * TypeScript "interfaces" describing the JSON the backend returns.
 * They don't exist at runtime: they only let the editor autocomplete and the
 * compiler catch typos (e.g. `game.tittle` would be a compile error).
 *
 * ALL PRICES ARE IN CENTS (5999 = $59.99). Use the `cents` pipe to display them.
 * ---------------------------------------------------------------------------
 */

// --------------------------------- Catalog ---------------------------------
export interface Genre {
  id: number;
  name: string;
  slug: string;
  gameCount?: number;
}

export interface Platform {
  id: number;
  code: 'pc' | 'ps5' | 'xbox' | 'switch';
  name: string;
}

/** The data needed to draw a game card in a grid. */
export interface GameSummary {
  id: number;
  slug: string;
  title: string;
  shortDescription: string;
  developer: string;
  publisher: string;
  releaseDate: string | null;
  ageRating: number;
  metacritic: number | null;
  price: number;           // cents, before discount
  discountPercent: number;
  finalPrice: number;      // cents, after discount
  stock: number;
  coverImage: string;
  headerImage: string;
  featured: boolean;
  genres: Genre[];
  platforms: Platform[];
  rating: number;          // average stars 0-5
  reviewCount: number;
}

export interface Trailer {
  title: string;
  url: string;             // HLS stream (.m3u8)
  thumbnail: string;
}

/** Everything shown on the product page. */
export interface GameDetail extends GameSummary {
  description: string;
  backgroundImage: string;
  steamUrl: string;
  screenshots: string[];
  trailers: Trailer[];
  ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  related: GameSummary[];
}

/** Response of GET /api/games (one page of results). */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface HomeSections {
  featured: GameSummary[];
  onSale: GameSummary[];
  newReleases: GameSummary[];
  topRated: GameSummary[];
  freeToPlay: GameSummary[];
}

export interface Review {
  id: number;
  gameId: number;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
  userId: number;
  userName: string;
  userAvatar: string;
  verifiedPurchase: boolean;
}

// ---------------------------------- Users ----------------------------------
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  avatarUrl: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ----------------------------------- Cart ----------------------------------
export interface CartItem {
  id: number;
  quantity: number;
  platform: Platform;
  game: GameSummary;
  unitPrice: number;
  originalUnitPrice: number;
  lineTotal: number;
}

export interface CartTotals {
  itemCount: number;
  subtotal: number;
  savings: number;
  coupon: { code: string; description: string; percentOff: number } | null;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
}

export interface Cart {
  items: CartItem[];
  totals: CartTotals;
  couponError: string | null;
}

// ---------------------------------- Orders ---------------------------------
export type OrderStatus = 'pending' | 'paid' | 'completed' | 'cancelled' | 'refunded';

export interface OrderItem {
  id: number;
  gameId: number | null;
  slug: string | null;     // null if the game was removed from the catalog
  title: string;
  coverImage: string;
  platformName: string;
  unitPrice: number;
  quantity: number;
  activationKeys: string[];
}

export interface Order {
  id: number;
  status: OrderStatus;
  createdAt: string;
  subtotal: number;
  couponCode: string | null;
  discount: number;
  tax: number;
  total: number;
  billing: { name: string; email: string; address: string; city: string; country: string };
  payment: { method: string; last4: string };
  items: OrderItem[];
}

/** Body sent to POST /api/orders. */
export interface CheckoutRequest {
  couponCode?: string;
  billing: Order['billing'];
  payment: { cardName: string; cardNumber: string; expiry: string; cvc: string };
}

// ---------------------------------- Admin ----------------------------------
export interface AdminStats {
  orders: number;
  revenue: number;
  customers: number;
  games: number;
  reviews: number;
  topSellers: { title: string; unitsSold: number; revenue: number }[];
  lowStock: { id: number; title: string; stock: number }[];
}

export interface AdminOrderRow {
  id: number;
  status: OrderStatus;
  total: number;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  itemCount: number;
}

/** Shape of every error the API returns. */
export interface ApiError {
  message: string;
  details?: Record<string, string>;
}
