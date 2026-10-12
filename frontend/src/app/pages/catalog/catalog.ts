/**
 * catalog.ts — /games : search, filter, sort and paginate the catalog.
 * ---------------------------------------------------------------------------
 * THE URL IS THE STATE. Filters live in the query string:
 *     /games?genre=rpg&platform=ps5&sort=price_asc&page=2
 * Benefits: you can bookmark/share a search, and Back/Forward work.
 *
 * Flow:
 *   1. withComponentInputBinding() copies each query param into the matching
 *      input() below (q, genre, platform...).
 *   2. httpResource reads those inputs -> when any changes, it re-fetches.
 *   3. Changing a filter = navigating to the same page with new query params.
 * ---------------------------------------------------------------------------
 */
import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Router } from '@angular/router';
import { API_URL } from '../../core/api';
import { GameSummary, Genre, Paginated, Platform } from '../../core/models/models';
import { GameCard } from '../../shared/components/game-card';

/** Options for the "Sort by" dropdown (value = what the API expects). */
const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'User rating' },
  { value: 'metacritic', label: 'Metacritic score' },
  { value: 'discount', label: 'Biggest discount' },
  { value: 'title', label: 'Name (A-Z)' },
];

const PRICE_OPTIONS = [
  { label: 'Any price', max: null },
  { label: 'Free', max: '0' },
  { label: 'Under $10', max: '10' },
  { label: 'Under $20', max: '20' },
  { label: 'Under $40', max: '40' },
];

@Component({
  selector: 'app-catalog',
  imports: [GameCard],
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss',
})
export class Catalog {
  private readonly router = inject(Router);

  // ---- Query params (filled automatically by the router) -------------------
  readonly q = input<string>();
  readonly genre = input<string>();
  readonly platform = input<string>();
  readonly sort = input<string>();
  readonly page = input<string>();
  readonly maxPrice = input<string>();
  readonly onSale = input<string>();
  readonly inStock = input<string>();

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly priceOptions = PRICE_OPTIONS;

  // ---- Data ----------------------------------------------------------------
  protected readonly genres = httpResource<Genre[]>(() => `${API_URL}/genres`, { defaultValue: [] });
  protected readonly platforms = httpResource<Platform[]>(() => `${API_URL}/platforms`, { defaultValue: [] });

  /** Re-runs automatically whenever one of the inputs it reads changes. */
  protected readonly results = httpResource<Paginated<GameSummary>>(() => {
    // Build the params object, leaving out the empty ones.
    const params: Record<string, string> = { limit: '18' };
    const entries = {
      q: this.q(), genre: this.genre(), platform: this.platform(), sort: this.sort(),
      page: this.page(), maxPrice: this.maxPrice(), onSale: this.onSale(), inStock: this.inStock(),
    };
    for (const [key, value] of Object.entries(entries)) {
      if (value) params[key] = value;
    }
    return { url: `${API_URL}/games`, params };
  });

  /**
   * linkedSignal = a writable signal that RESETS from a source signal.
   * Here it keeps showing the PREVIOUS page of results while the next one
   * loads (instead of the grid flashing empty on every filter click).
   */
  protected readonly lastResults = linkedSignal<Paginated<GameSummary> | undefined, Paginated<GameSummary> | undefined>({
    source: () => this.results.value(),
    computation: (value, previous) => value ?? previous?.value,
  });

  protected readonly currentPage = computed(() => Number(this.page()) || 1);
  protected readonly hasFilters = computed(
    () => !!(this.q() || this.genre() || this.platform() || this.maxPrice() || this.onSale() || this.inStock()),
  );

  /** Page numbers for the paginator, e.g. [1, 2, 3, 4]. */
  protected readonly pages = computed(() =>
    Array.from({ length: this.lastResults()?.totalPages ?? 0 }, (_, i) => i + 1),
  );

  /**
   * Changes one or more query params. `null` removes a param from the URL.
   * Any filter change also resets the page to 1 (page: null).
   */
  protected setFilters(changes: Record<string, string | null>, resetPage = true) {
    this.router.navigate([], {
      queryParams: { ...(resetPage && { page: null }), ...changes },
      queryParamsHandling: 'merge', // keep the other params as they are
    });
  }

  protected toggle(key: string, value: string | undefined, current: string | undefined) {
    this.setFilters({ [key]: current === value ? null : (value ?? null) });
  }

  protected goToPage(page: number) {
    this.setFilters({ page: page > 1 ? String(page) : null }, false);
  }

  protected clearAll() {
    this.router.navigate([], { queryParams: {} });
  }
}
