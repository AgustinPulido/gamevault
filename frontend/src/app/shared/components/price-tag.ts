/**
 * price-tag.ts — shows a price with its discount, Steam style:
 *     [-50%]  $̶5̶9̶.̶9̶9̶  $29.99
 * ---------------------------------------------------------------------------
 * This component has an INLINE template and styles (instead of separate
 * .html/.scss files). Handy for small components.
 * input() declares a property the parent sets: <app-price-tag [price]="..." />
 * ---------------------------------------------------------------------------
 */
import { Component, input } from '@angular/core';
import { CentsPipe } from '../pipes/cents.pipe';

@Component({
  selector: 'app-price-tag',
  imports: [CentsPipe], // everything the template uses must be imported
  template: `
    <!-- @if is Angular's built-in control flow (replaces *ngIf) -->
    @if (finalPrice() === 0) {
      <span class="final free">Free to play</span>
    } @else {
      @if (discountPercent() > 0) {
        <span class="badge sale">-{{ discountPercent() }}%</span>
        <span class="original">{{ price() | cents }}</span>
      }
      <span class="final">{{ finalPrice() | cents }}</span>
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    :host(.large) .final { font-size: 1.8rem; }
    :host(.large) .badge { font-size: 0.95rem; padding: 4px 10px; }
    .original { color: var(--text-muted); text-decoration: line-through; font-size: 0.85em; }
    .final { font-weight: 700; font-size: 1.05rem; }
    .free { color: var(--sale); }
  `,
})
export class PriceTag {
  // input.required = the parent MUST provide it; input(0) has a default.
  readonly price = input.required<number>();
  readonly finalPrice = input.required<number>();
  readonly discountPercent = input(0);
}
