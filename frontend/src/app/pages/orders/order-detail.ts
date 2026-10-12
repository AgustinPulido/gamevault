/**
 * order-detail.ts — /orders/:id — receipt with the activation keys.
 * After checkout we land here with ?placed=true to show a "thank you" banner.
 */
import { httpResource } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { API_URL } from '../../core/api';
import { Order } from '../../core/models/models';
import { ToastService } from '../../core/services/toast.service';
import { CentsPipe } from '../../shared/pipes/cents.pipe';
import { OrderStatusBadge } from './order-status-badge';

@Component({
  selector: 'app-order-detail',
  imports: [RouterLink, DatePipe, CentsPipe, OrderStatusBadge],
  templateUrl: './order-detail.html',
  styleUrl: './order-detail.scss',
})
export class OrderDetail {
  private readonly toast = inject(ToastService);

  readonly id = input.required<string>();      // route param :id
  readonly placed = input<string>();           // query param ?placed=true

  protected readonly order = httpResource<Order>(() => `${API_URL}/orders/${this.id()}`);

  /** Copies an activation key using the browser Clipboard API. */
  protected async copy(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      this.toast.success('Key copied to clipboard');
    } catch {
      this.toast.error('Could not copy the key');
    }
  }
}
