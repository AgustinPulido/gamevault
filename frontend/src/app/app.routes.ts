/**
 * app.routes.ts — maps URLs to page components.
 * ---------------------------------------------------------------------------
 * `loadComponent: () => import(...)` = LAZY LOADING: the code of a page is
 * downloaded only when the user visits it, which keeps the first load fast.
 * (Run `ng build` and you'll see one small JS "chunk" per page.)
 * ---------------------------------------------------------------------------
 */
import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/guards/auth.guards';

export const routes: Routes = [
  {
    path: '',
    title: 'GameVault — Video Game Store',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'games',
    title: 'Browse games — GameVault',
    loadComponent: () => import('./pages/catalog/catalog').then((m) => m.Catalog),
  },
  {
    // ":slug" is a route parameter -> /games/elden-ring gives slug = 'elden-ring'
    path: 'games/:slug',
    loadComponent: () => import('./pages/game-detail/game-detail').then((m) => m.GameDetailPage),
  },
  {
    path: 'cart',
    title: 'Your cart — GameVault',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/cart/cart').then((m) => m.CartPage),
  },
  {
    path: 'checkout',
    title: 'Checkout — GameVault',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/checkout/checkout').then((m) => m.Checkout),
  },
  {
    path: 'orders',
    title: 'My orders — GameVault',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/orders/orders').then((m) => m.Orders),
  },
  {
    path: 'orders/:id',
    title: 'Order details — GameVault',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/orders/order-detail').then((m) => m.OrderDetail),
  },
  {
    path: 'wishlist',
    title: 'Wishlist — GameVault',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/wishlist/wishlist').then((m) => m.Wishlist),
  },
  {
    path: 'login',
    title: 'Sign in — GameVault',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/login').then((m) => m.Login),
  },
  {
    path: 'register',
    title: 'Create account — GameVault',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/register').then((m) => m.Register),
  },
  {
    path: 'admin',
    title: 'Admin — GameVault',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/admin/admin').then((m) => m.Admin),
  },
  {
    // "**" matches anything not matched above -> 404 page. Must be LAST.
    path: '**',
    title: 'Page not found — GameVault',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
