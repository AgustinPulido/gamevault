/**
 * cart.ts — /cart — review items, change quantities, apply a coupon.
 * All the state comes from CartService (shared with the header badge).
 */
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../../core/api';
import { CartItem } from '../../core/models/models';
import { CartService } from '../../core/services/cart.service';
import { ToastService } from '../../core/services/toast.service';
import { CentsPipe } from '../../shared/pipes/cents.pipe';

@Component({
  selector: 'app-cart',
  imports: [RouterLink, CentsPipe],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class CartPage {
  protected readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);

  /** Id of the line being updated (to disable its buttons meanwhile). */
  protected readonly busyItem = signal<number | null>(null);

  constructor() {
    // Always show fresh data (prices/stock may have changed).
    this.cart.load().subscribe();
  }

  protected setQuantity(item: CartItem, quantity: number) {
    if (quantity < 1 || quantity > 10) return;
    this.busyItem.set(item.id);
    this.cart.updateQuantity(item.id, quantity).subscribe({
      next: () => this.busyItem.set(null),
      error: (err) => {
        this.busyItem.set(null);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected remove(item: CartItem) {
    this.cart.remove(item.id).subscribe(() => this.toast.success(`${item.game.title} removed`));
  }

  protected applyCoupon(code: string) {
    if (!code.trim()) return;
    this.cart.applyCoupon(code).subscribe((c) => {
      if (c.couponError) this.toast.error(c.couponError);
      else this.toast.success(`Coupon ${c.totals.coupon?.code} applied!`);
    });
  }

  protected removeCoupon() {
    this.cart.applyCoupon(null).subscribe();
  }
}
