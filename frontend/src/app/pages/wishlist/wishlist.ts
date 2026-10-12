/**
 * wishlist.ts — /wishlist — games saved for later (data from WishlistService).
 */
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WishlistService } from '../../core/services/wishlist.service';
import { GameCard } from '../../shared/components/game-card';

@Component({
  selector: 'app-wishlist',
  imports: [RouterLink, GameCard],
  template: `
    <div class="container page">
      <h1>Your wishlist</h1>
      @if (wishlist.count()) {
        <p class="muted">{{ wishlist.count() }} saved games. Click the heart to remove one.</p>
        <div class="game-grid">
          @for (game of wishlist.games(); track game.id) {
            <app-game-card [game]="game" />
          }
        </div>
      } @else {
        <div class="empty-state">
          <span class="icon">favorite</span>
          <h2>Your wishlist is empty</h2>
          <p>Tap the heart on any game to save it here.</p>
          <a routerLink="/games" class="btn primary">Discover games</a>
        </div>
      }
    </div>
  `,
})
export class Wishlist {
  protected readonly wishlist = inject(WishlistService);
}
