/**
 * game-reviews.ts — rating summary, list of reviews and "write a review" form.
 * ---------------------------------------------------------------------------
 * The form uses SIGNAL FORMS (@angular/forms/signals, stable since v22):
 *   1. The data lives in a plain signal:     model = signal({ rating: 0, ... })
 *   2. form(model, schema) creates a FieldTree with validation rules.
 *   3. In the template, [formField]="reviewForm.title" binds an <input> to a field.
 *   4. Each field exposes signals: value(), errors(), touched(), invalid()...
 *   5. <form [formRoot]="reviewForm"> + the `submission.action` handle submit:
 *      the action only runs if the form is valid.
 * ---------------------------------------------------------------------------
 */
import { HttpClient, httpResource } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { form, FormField, FormRoot, maxLength, min, minLength, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_URL, errorMessage } from '../../core/api';
import { GameDetail, Review } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { StarRating } from '../../shared/components/star-rating';

@Component({
  selector: 'app-game-reviews',
  imports: [DatePipe, RouterLink, StarRating, FormField, FormRoot],
  templateUrl: './game-reviews.html',
  styleUrl: './game-reviews.scss',
})
export class GameReviews {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  readonly game = input.required<GameDetail>();
  /** output() = an event the PARENT can listen to: (reviewChanged)="..." */
  readonly reviewChanged = output<void>();

  protected readonly sort = signal<'newest' | 'rating'>('newest');
  protected readonly reviews = httpResource<Review[]>(
    () => ({ url: `${API_URL}/games/${this.game().id}/reviews`, params: { sort: this.sort() } }),
    { defaultValue: [] },
  );

  /** The logged-in user's own review (they can only write one). */
  protected readonly myReview = computed(() =>
    this.reviews.value().find((r) => r.userId === this.auth.user()?.id),
  );

  /** Data for the 5 horizontal bars: [{ stars: 5, count: 10, percent: 62 }, ...] */
  protected readonly bars = computed(() => {
    const breakdown = this.game().ratingBreakdown;
    const total = this.game().reviewCount || 1;
    return ([5, 4, 3, 2, 1] as const).map((stars) => ({
      stars,
      count: breakdown[stars],
      percent: Math.round((breakdown[stars] / total) * 100),
    }));
  });

  // ------------------------------ The form ------------------------------
  private readonly emptyReview = { rating: 0, title: '', body: '' };
  protected readonly model = signal({ ...this.emptyReview });

  protected readonly reviewForm = form(
    this.model,
    // SCHEMA: validation rules for each field (path = the field tree).
    (path) => {
      min(path.rating, 1, { message: 'Pick a rating from 1 to 5 stars' });
      required(path.title, { message: 'Give your review a title' });
      minLength(path.title, 3, { message: 'Title must be at least 3 characters' });
      maxLength(path.title, 80);
      required(path.body, { message: 'Tell other players what you think' });
      minLength(path.body, 10, { message: 'Write at least 10 characters' });
      maxLength(path.body, 2000);
    },
    {
      submission: {
        // Runs on submit, ONLY when every rule passes.
        action: async () => {
          try {
            await firstValueFrom(
              this.http.post<Review>(`${API_URL}/games/${this.game().id}/reviews`, this.model()),
            );
            this.toast.success('Thanks for your review!');
            this.reviewForm().reset(); // clear touched/dirty state
            this.model.set({ ...this.emptyReview });
            this.reviews.reload();
            this.reviewChanged.emit();
            return undefined; // undefined = success, no errors
          } catch (err) {
            // Returning an error attaches it to the form (shown in the template).
            return { kind: 'server', message: errorMessage(err) };
          }
        },
      },
    },
  );

  protected deleteReview(review: Review) {
    this.http.delete(`${API_URL}/reviews/${review.id}`).subscribe({
      next: () => {
        this.toast.success('Review deleted');
        this.reviews.reload();
        this.reviewChanged.emit();
      },
      error: (err) => this.toast.error(errorMessage(err)),
    });
  }
}
