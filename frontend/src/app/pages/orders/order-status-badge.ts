/**
 * order-status-badge.ts — colored pill for an order status (paid, refunded...).
 * Used by the orders pages and the admin panel.
 */
import { Component, computed, input } from '@angular/core';
import { OrderStatus } from '../../core/models/models';

// Each status -> badge color class (defined in styles.scss).
const STATUS_CLASS: Record<OrderStatus, string> = {
  pending: 'warning',
  paid: 'info',
  completed: 'success',
  cancelled: 'danger',
  refunded: 'danger',
};

@Component({
  selector: 'app-order-status-badge',
  template: `<span class="badge" [class]="cssClass()">{{ status() }}</span>`,
  styles: `.badge { text-transform: capitalize; }`,
})
export class OrderStatusBadge {
  readonly status = input.required<OrderStatus>();
  protected readonly cssClass = computed(() => 'badge ' + STATUS_CLASS[this.status()]);
}
