/**
 * cart.service.ts — shopping cart state shared by the whole app.
 * ---------------------------------------------------------------------------
 * The cart lives in the DATABASE (per user). This service keeps a local copy
 * in a signal so the header badge, the cart page and the checkout all show
 * the same data. After each change we reload the cart (so the coupon is
 * re-applied by the server) and replace the signal's value.
 * ---------------------------------------------------------------------------
 */
import { HttpClient, HttpParams } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Observable, switchMap, tap } from 'rxjs';
import { API_URL } from '../api';
import { Cart } from '../models/models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly _cart = signal<Cart | null>(null);
  readonly cart = this._cart.asReadonly();

  /** Coupon typed by the user on the cart page; reused by the checkout. */
  readonly couponCode = signal<string | null>(null);

  readonly items = computed(() => this._cart()?.items ?? []);
  readonly count = computed(() => this._cart()?.totals.itemCount ?? 0);
  readonly isEmpty = computed(() => this.items().length === 0);

  constructor() {
    // effect() runs now AND every time a signal it reads changes.
    // Here: when the user logs in -> load their cart; logs out -> clear it.
    effect(() => {
      if (this.auth.isLoggedIn()) {
        // untracked(): load() reads couponCode, but we DON'T want this effect
        // to re-run when the coupon changes, only when login state changes.
        untracked(() => this.load().subscribe());
      } else {
        this._cart.set(null);
        this.couponCode.set(null);
      }
    });
  }

  /** Reloads the cart (applying the current coupon, if any). */
  load(): Observable<Cart> {
    let params = new HttpParams();
    const coupon = this.couponCode();
    if (coupon) params = params.set('coupon', coupon);
    return this.http.get<Cart>(`${API_URL}/cart`, { params }).pipe(tap((c) => this.setCart(c)));
  }

  add(gameId: number, platformId: number, quantity = 1) {
    return this.http
      .post<Cart>(`${API_URL}/cart`, { gameId, platformId, quantity })
      // switchMap: when the POST finishes, chain a GET to reload the cart with
      // the coupon re-applied. Subscribers receive that final cart.
      .pipe(switchMap(() => this.load()));
  }

  updateQuantity(itemId: number, quantity: number) {
    return this.http
      .patch<Cart>(`${API_URL}/cart/${itemId}`, { quantity })
      .pipe(switchMap(() => this.load()));
  }

  remove(itemId: number) {
    return this.http
      .delete<Cart>(`${API_URL}/cart/${itemId}`)
      .pipe(switchMap(() => this.load()));
  }

  applyCoupon(code: string | null) {
    this.couponCode.set(code?.trim().toUpperCase() || null);
    return this.load();
  }

  /** Called after a successful checkout (the backend already emptied it). */
  reset() {
    this.couponCode.set(null);
    this.load().subscribe();
  }

  private setCart(cart: Cart) {
    // If the coupon became invalid (e.g. subtotal dropped below the minimum)
    // the backend returns couponError and no coupon -> forget it locally.
    if (cart.couponError) this.couponCode.set(null);
    this._cart.set(cart);
  }
}
