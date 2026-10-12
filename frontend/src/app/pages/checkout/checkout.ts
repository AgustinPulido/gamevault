/**
 * checkout.ts — /checkout — billing info + (fake) card payment.
 * ---------------------------------------------------------------------------
 * Shows a NESTED signal form (billing.* and payment.*) with:
 *   - built-in validators: required, email, pattern
 *   - a CUSTOM validator: validate() with the Luhn checksum for card numbers
 *   - server errors (e.g. "card declined") returned from submission.action
 *
 * Remember: the backend re-validates everything and recalculates the total.
 * ---------------------------------------------------------------------------
 */
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { email, form, FormField, FormRoot, pattern, required, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_URL, errorMessage } from '../../core/api';
import { CheckoutRequest, Order } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { FieldErrors } from '../../shared/components/field-errors';
import { CentsPipe } from '../../shared/pipes/cents.pipe';

/** Luhn checksum: catches mistyped card numbers (see backend for details). */
function passesLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return digits.length >= 12 && sum % 10 === 0;
}

@Component({
  selector: 'app-checkout',
  imports: [RouterLink, CentsPipe, FormField, FormRoot, FieldErrors],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class Checkout {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  protected readonly cart = inject(CartService);

  // Pre-fill name and email with the logged-in user's data.
  private readonly user = inject(AuthService).user();

  protected readonly model = signal<Omit<CheckoutRequest, 'couponCode'>>({
    billing: {
      name: this.user?.name ?? '',
      email: this.user?.email ?? '',
      address: '',
      city: '',
      country: '',
    },
    payment: { cardName: '', cardNumber: '', expiry: '', cvc: '' },
  });

  protected readonly checkoutForm = form(
    this.model,
    (path) => {
      // ----- billing -----
      required(path.billing.name, { message: 'Full name is required' });
      required(path.billing.email, { message: 'Email is required' });
      email(path.billing.email, { message: 'Enter a valid email' });
      required(path.billing.address, { message: 'Address is required' });
      required(path.billing.city, { message: 'City is required' });
      required(path.billing.country, { message: 'Country is required' });

      // ----- payment -----
      required(path.payment.cardName, { message: 'Name on card is required' });
      required(path.payment.cardNumber, { message: 'Card number is required' });
      pattern(path.payment.cardNumber, /^[\d ]{12,23}$/, { message: 'Only digits and spaces' });
      // Custom rule: return undefined when OK, or an error object.
      validate(path.payment.cardNumber, ({ value }) =>
        value() && !passesLuhn(value()) ? { kind: 'luhn', message: 'This card number is not valid' } : undefined,
      );
      required(path.payment.expiry, { message: 'Expiry is required' });
      pattern(path.payment.expiry, /^(0[1-9]|1[0-2])\/\d{2}$/, { message: 'Use the MM/YY format' });
      required(path.payment.cvc, { message: 'CVC is required' });
      pattern(path.payment.cvc, /^\d{3,4}$/, { message: '3 or 4 digits' });
    },
    {
      submission: {
        action: async () => {
          try {
            const body: CheckoutRequest = { ...this.model(), couponCode: this.cart.couponCode() ?? undefined };
            const order = await firstValueFrom(this.http.post<Order>(`${API_URL}/orders`, body));
            // Navigate FIRST, then refresh the (now empty) cart; otherwise this
            // page would briefly flash its "Nothing to pay for" state.
            await this.router.navigate(['/orders', order.id], { queryParams: { placed: true } });
            this.cart.reset();
            return undefined;
          } catch (err) {
            return { kind: 'server', message: errorMessage(err) };
          }
        },
      },
    },
  );

  /** Shortcut button so you don't have to type the test card. */
  protected fillTestCard(declined = false) {
    this.model.update((m) => ({
      ...m,
      payment: {
        cardName: m.billing.name || 'Demo Player',
        cardNumber: declined ? '4000 0000 0000 0002' : '4242 4242 4242 4242',
        expiry: '12/30',
        cvc: '123',
      },
    }));
  }
}
