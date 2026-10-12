/**
 * wishlist.service.ts — games the user saved for later.
 * Same pattern as CartService: server is the source of truth, a signal keeps
 * a local copy so heart icons everywhere know if a game is wish-listed.
 */
import { HttpClient } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { API_URL, errorMessage } from '../api';
import { GameSummary } from '../models/models';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  private readonly _games = signal<GameSummary[]>([]);
  readonly games = this._games.asReadonly();

  /** A Set of ids makes "is this game in my wishlist?" an O(1) lookup. */
  private readonly ids = computed(() => new Set(this._games().map((g) => g.id)));
  readonly count = computed(() => this._games().length);

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.http.get<GameSummary[]>(`${API_URL}/wishlist`).subscribe((g) => this._games.set(g));
      } else {
        this._games.set([]);
      }
    });
  }

  has(gameId: number): boolean {
    return this.ids().has(gameId);
  }

  /** Adds or removes a game. Guests are sent to the login page. */
  toggle(game: Pick<GameSummary, 'id' | 'title'>) {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const adding = !this.has(game.id);
    const request = adding
      ? this.http.post<GameSummary[]>(`${API_URL}/wishlist/${game.id}`, {})
      : this.http.delete<GameSummary[]>(`${API_URL}/wishlist/${game.id}`);

    request.subscribe({
      next: (list) => {
        this._games.set(list);
        this.toast.success(adding ? `${game.title} added to your wishlist` : `${game.title} removed from your wishlist`);
      },
      error: (err) => this.toast.error(errorMessage(err)),
    });
  }
}
