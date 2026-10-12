/**
 * game-card.ts — the box-art card used in every grid of games.
 * Clicking the card opens the product page; the heart toggles the wishlist.
 */
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameSummary } from '../../core/models/models';
import { WishlistService } from '../../core/services/wishlist.service';
import { PriceTag } from './price-tag';
import { StarRating } from './star-rating';

@Component({
  selector: 'app-game-card',
  imports: [RouterLink, PriceTag, StarRating],
  template: `
    @let g = game();  <!-- @let declares a local template variable -->
    <a class="card-link" [routerLink]="['/games', g.slug]">
      <div class="cover">
        <!-- loading="lazy": the browser only downloads images near the viewport -->
        <img [src]="g.coverImage" [alt]="g.title + ' cover'" loading="lazy" />
        @if (g.stock === 0) {
          <span class="badge danger stock">Sold out</span>
        } @else if (g.stock < 5) {
          <span class="badge warning stock">Only {{ g.stock }} left</span>
        }
      </div>
      <div class="body">
        <h3 class="title" [title]="g.title">{{ g.title }}</h3>
        <div class="meta">
          <app-star-rating [value]="g.rating" />
          <span class="muted">({{ g.reviewCount }})</span>
        </div>
        <div class="platforms">
          @for (p of g.platforms; track p.id) {
            <span class="plat" [title]="p.name">{{ p.code }}</span>
          }
        </div>
        <app-price-tag [price]="g.price" [finalPrice]="g.finalPrice" [discountPercent]="g.discountPercent" />
      </div>
    </a>
    <!-- The heart is OUTSIDE the <a>, so clicking it doesn't open the game page -->
    <button class="wish" type="button" (click)="wishlist.toggle(g)"
            [attr.aria-label]="inWishlist() ? 'Remove from wishlist' : 'Add to wishlist'">
      <span class="icon" [class.filled]="inWishlist()">favorite</span>
    </button>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
    }
    :host:hover { transform: translateY(-4px); border-color: var(--primary); box-shadow: var(--shadow); }
    .card-link { color: inherit; text-decoration: none; display: block; }
    .cover { position: relative; aspect-ratio: 2 / 3; background: var(--surface-2); overflow: hidden; }
    .cover img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s; }
    :host:hover .cover img { transform: scale(1.05); }
    .stock { position: absolute; left: 8px; bottom: 8px; }
    .body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 6px; }
    .title {
      font-family: var(--font-body); font-size: 0.95rem; font-weight: 600; margin: 0;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .meta { display: flex; align-items: center; gap: 4px; font-size: 0.8rem; }
    .platforms { display: flex; gap: 4px; }
    .plat {
      font-size: 0.65rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;
      padding: 1px 6px; border-radius: 4px; background: var(--surface-3); color: var(--text-muted);
    }
    .wish {
      position: absolute; top: 8px; right: 8px; width: 36px; height: 36px; border-radius: 50%;
      border: 0; cursor: pointer; display: grid; place-items: center;
      background: rgba(10, 13, 22, 0.75); backdrop-filter: blur(4px); color: #fff;
    }
    .wish .filled { color: #f43f5e; }
    .wish:hover { background: rgba(10, 13, 22, 0.95); }
  `,
})
export class GameCard {
  readonly game = input.required<GameSummary>();
  protected readonly wishlist = inject(WishlistService);
  protected readonly inWishlist = computed(() => this.wishlist.has(this.game().id));
}
