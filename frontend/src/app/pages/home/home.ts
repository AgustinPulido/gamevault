/**
 * home.ts — landing page: featured carousel + curated game rows.
 * ---------------------------------------------------------------------------
 * DATA LOADING WITH httpResource
 * `httpResource(() => url)` performs a GET request and exposes the result as
 * signals:
 *    .value()      the parsed JSON (undefined while loading)
 *    .isLoading()  true while the request is in flight
 *    .error()      the error, if it failed
 *    .hasValue()   true once data arrived
 *    .reload()     fetch again
 * If the url function reads other signals, the request is re-sent
 * automatically when they change (see catalog.ts for that).
 * ---------------------------------------------------------------------------
 */
import { httpResource } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { API_URL } from '../../core/api';
import { Genre, HomeSections } from '../../core/models/models';
import { GameCard } from '../../shared/components/game-card';
import { PriceTag } from '../../shared/components/price-tag';

@Component({
  selector: 'app-home',
  imports: [RouterLink, GameCard, PriceTag],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly sections = httpResource<HomeSections>(() => `${API_URL}/games/home`);
  protected readonly genres = httpResource<Genre[]>(() => `${API_URL}/genres`, { defaultValue: [] });

  /** Index of the slide currently shown in the hero carousel. */
  protected readonly slide = signal(0);
  protected readonly featured = computed(() => this.sections.value()?.featured ?? []);
  protected readonly current = computed(() => this.featured()[this.slide()]);

  constructor() {
    // Auto-advance the carousel every 6 seconds.
    const timer = setInterval(() => this.next(), 6000);
    // DestroyRef: run cleanup code when the page is left (avoid memory leaks).
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected next() {
    const total = this.featured().length;
    if (total) this.slide.update((i) => (i + 1) % total);
  }

  protected prev() {
    const total = this.featured().length;
    if (total) this.slide.update((i) => (i - 1 + total) % total);
  }
}
