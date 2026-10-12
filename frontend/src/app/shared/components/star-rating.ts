/**
 * star-rating.ts — displays 0-5 stars. Can also be used as an INPUT control
 * (click a star to choose a rating) when `editable` is true.
 *
 *   <app-star-rating [value]="4.3" />                              read only
 *   <app-star-rating [(value)]="myRating" [editable]="true" />     editable
 *
 * `model()` is like input() but TWO-WAY: the child can write the value back
 * to the parent ("banana in a box" syntax [( )]).
 *
 * It also implements FormValueControl, the contract Signal Forms uses for
 * CUSTOM form controls. That's why it can be bound to a form field directly:
 *   <app-star-rating [formField]="reviewForm.rating" [editable]="true" />
 */
import { Component, computed, input, model } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

@Component({
  selector: 'app-star-rating',
  template: `
    @for (star of stars(); track $index) {
      @if (editable()) {
        <button type="button" class="star" (click)="value.set($index + 1)"
                [attr.aria-label]="'Rate ' + ($index + 1) + ' stars'">
          <span class="icon" [class.filled]="star === 'full'">star</span>
        </button>
      } @else {
        <span class="icon" [class.filled]="star !== 'empty'">
          {{ star === 'half' ? 'star_half' : 'star' }}
        </span>
      }
    }
    @if (showValue() && value() > 0) {
      <span class="value">{{ value().toFixed(1) }}</span>
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 1px; color: #fbbf24; }
    .icon { font-size: 1.1em; }
    .star { background: none; border: 0; padding: 0; color: inherit; cursor: pointer; font-size: 1.6rem; }
    .star:hover { transform: scale(1.15); }
    .value { margin-left: 6px; color: var(--text); font-weight: 600; font-size: 0.9em; }
  `,
})
export class StarRating implements FormValueControl<number> {
  readonly value = model(0);
  readonly editable = input(false);
  readonly showValue = input(false);

  /** Converts e.g. 3.6 into ['full','full','full','half','empty']. */
  protected readonly stars = computed(() =>
    Array.from({ length: 5 }, (_, i) => {
      const diff = this.value() - i;
      return diff >= 0.75 ? 'full' : diff >= 0.25 ? 'half' : 'empty';
    }),
  );
}
