/**
 * orders.ts — /orders — purchase history of the logged-in user.
 */
import { httpResource } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { API_URL } from '../../core/api';
import { Order } from '../../core/models/models';
import { CentsPipe } from '../../shared/pipes/cents.pipe';
import { OrderStatusBadge } from './order-status-badge';

@Component({
  selector: 'app-orders',
  imports: [RouterLink, DatePipe, CentsPipe, OrderStatusBadge],
  template: `
    <div class="container page">
      <h1>My orders</h1>

      @for (order of orders.value(); track order.id) {
        <a class="order card" [routerLink]="['/orders', order.id]">
          <div class="covers">
            <!-- Show up to 4 covers, stacked -->
            @for (item of order.items.slice(0, 4); track item.id) {
              <img [src]="item.coverImage" [alt]="item.title" />
            }
          </div>
          <div class="info">
            <strong>Order #{{ order.id }}</strong>
            <span class="muted">{{ order.createdAt | date: 'medium' }}</span>
            <span class="muted titles">{{ titles(order) }}</span>
          </div>
          <app-order-status-badge [status]="order.status" />
          <strong class="total">{{ order.total | cents }}</strong>
          <span class="icon muted">chevron_right</span>
        </a>
      } @empty {
        @if (orders.isLoading()) {
          <div class="skeleton" style="height: 120px"></div>
        } @else {
          <div class="empty-state">
            <span class="icon">receipt_long</span>
            <h2>No orders yet</h2>
            <a routerLink="/games" class="btn primary">Start shopping</a>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .order {
      display: grid; grid-template-columns: auto 1fr auto auto auto; align-items: center; gap: 20px;
      margin-bottom: 12px; color: var(--text); text-decoration: none; transition: border-color 0.15s;
    }
    .order:hover { border-color: var(--primary); }
    .covers { display: flex; }
    .covers img {
      width: 48px; aspect-ratio: 2 / 3; object-fit: cover; border-radius: 4px;
      border: 2px solid var(--surface); margin-left: -14px;
    }
    .covers img:first-child { margin-left: 0; }
    .info { display: flex; flex-direction: column; gap: 2px; min-width: 0; font-size: 0.9rem; }
    .titles { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .total { font-size: 1.1rem; }
    @media (max-width: 640px) {
      .order { grid-template-columns: auto 1fr auto; }
      .order > .icon, .covers { display: none; }
    }
  `,
})
export class Orders {
  protected readonly orders = httpResource<Order[]>(() => `${API_URL}/orders`, { defaultValue: [] });

  protected titles(order: Order) {
    return order.items.map((i) => i.title).join(', ');
  }
}
