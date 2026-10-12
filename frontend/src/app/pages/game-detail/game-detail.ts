/**
 * game-detail.ts — /games/:slug — the product page.
 * Media gallery (trailers + screenshots), purchase box, description,
 * reviews and related games.
 */
import { httpResource } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { API_URL, errorMessage } from '../../core/api';
import { GameDetail } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { ToastService } from '../../core/services/toast.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { GameCard } from '../../shared/components/game-card';
import { PriceTag } from '../../shared/components/price-tag';
import { StarRating } from '../../shared/components/star-rating';
import { TrailerPlayer } from '../../shared/components/trailer-player';
import { GameReviews } from './game-reviews';

/** One item of the gallery: either a video or an image. */
type MediaItem =
  | { kind: 'trailer'; url: string; thumbnail: string; title: string }
  | { kind: 'image'; url: string; thumbnail: string; title: string };

@Component({
  selector: 'app-game-detail',
  imports: [RouterLink, DatePipe, PriceTag, StarRating, TrailerPlayer, GameCard, GameReviews],
  templateUrl: './game-detail.html',
  styleUrl: './game-detail.scss',
})
export class GameDetailPage {
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly wishlist = inject(WishlistService);

  /** From the URL /games/:slug (thanks to withComponentInputBinding). */
  readonly slug = input.required<string>();

  protected readonly game = httpResource<GameDetail>(() => `${API_URL}/games/${this.slug()}`);

  /** Trailers first, then screenshots, as one list for the gallery. */
  protected readonly media = computed<MediaItem[]>(() => {
    const g = this.game.value();
    if (!g) return [];
    return [
      ...g.trailers.map((t) => ({ kind: 'trailer' as const, url: t.url, thumbnail: t.thumbnail, title: t.title })),
      ...g.screenshots.map((s, i) => ({ kind: 'image' as const, url: s, thumbnail: s, title: `Screenshot ${i + 1}` })),
    ];
  });

  // linkedSignal: resets to 0 every time the media list changes (new game),
  // but can still be set by the user when clicking a thumbnail.
  protected readonly selectedIndex = linkedSignal(() => (this.media(), 0));
  protected readonly selected = computed(() => this.media()[this.selectedIndex()]);

  /** Selected platform; defaults to the game's first platform. */
  protected readonly platformId = linkedSignal(() => this.game.value()?.platforms[0]?.id ?? null);
  /** Back to 1 whenever we navigate to a different game. */
  protected readonly quantity = linkedSignal(() => (this.slug(), 1));
  protected readonly adding = signal(false);

  protected readonly inWishlist = computed(() => {
    const g = this.game.value();
    return g ? this.wishlist.has(g.id) : false;
  });

  constructor() {
    // Update the browser tab title when the game loads.
    const title = inject(Title);
    effect(() => {
      const g = this.game.value();
      if (g) title.setTitle(`${g.title} — GameVault`);
    });
  }

  protected addToCart(goToCart = false) {
    const g = this.game.value();
    const platformId = this.platformId();
    if (!g || !platformId) return;

    // Guests must sign in first; afterwards they come back to this page.
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    this.adding.set(true);
    this.cart.add(g.id, platformId, this.quantity()).subscribe({
      next: () => {
        this.adding.set(false);
        this.toast.success(`${g.title} added to your cart`);
        if (goToCart) this.router.navigate(['/cart']);
      },
      error: (err) => {
        this.adding.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected changeQuantity(delta: number) {
    // Clamp between 1 and 10 (and never above the stock).
    const max = Math.min(10, this.game.value()?.stock ?? 10);
    this.quantity.update((q) => Math.max(1, Math.min(max, q + delta)));
  }
}
