/**
 * admin.ts — /admin — back office (admins only, see adminGuard).
 * Tabs: Dashboard (stats), Inventory (edit price/discount/stock), Orders.
 */
import { HttpClient, httpResource } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { API_URL, errorMessage } from '../../core/api';
import { AdminOrderRow, AdminStats, GameSummary, OrderStatus } from '../../core/models/models';
import { ToastService } from '../../core/services/toast.service';
import { CentsPipe } from '../../shared/pipes/cents.pipe';
import { OrderStatusBadge } from '../orders/order-status-badge';

type Tab = 'dashboard' | 'inventory' | 'orders';

@Component({
  selector: 'app-admin',
  imports: [RouterLink, DatePipe, CentsPipe, OrderStatusBadge],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);

  protected readonly tab = signal<Tab>('dashboard');
  protected readonly statuses: OrderStatus[] = ['pending', 'paid', 'completed', 'cancelled', 'refunded'];

  protected readonly stats = httpResource<AdminStats>(() => `${API_URL}/admin/stats`);
  protected readonly games = httpResource<GameSummary[]>(() => `${API_URL}/admin/games`, { defaultValue: [] });
  protected readonly orders = httpResource<AdminOrderRow[]>(() => `${API_URL}/admin/orders`, { defaultValue: [] });

  /** Text typed in the inventory search box. */
  protected readonly filter = signal('');
  protected readonly filteredGames = computed(() => {
    const term = this.filter().toLowerCase();
    return this.games.value().filter((g) => g.title.toLowerCase().includes(term));
  });

  /** Id of the game row currently being saved. */
  protected readonly savingId = signal<number | null>(null);

  /**
   * Saves one inventory row. The price is typed in DOLLARS and converted to
   * cents, because that's what the API stores.
   */
  protected saveGame(game: GameSummary, price: string, discount: string, stock: string, featured: boolean) {
    const body = {
      price: Math.round(Number(price) * 100),
      discountPercent: Number(discount),
      stock: Number(stock),
      featured,
    };
    this.savingId.set(game.id);
    this.http.patch<GameSummary>(`${API_URL}/admin/games/${game.id}`, body).subscribe({
      next: (updated) => {
        this.savingId.set(null);
        // Replace the edited game in the resource's local value (no refetch needed).
        this.games.update((list) => list.map((g) => (g.id === updated.id ? updated : g)));
        this.stats.reload(); // low-stock list may have changed
        this.toast.success(`${updated.title} saved`);
      },
      error: (err) => {
        this.savingId.set(null);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected changeStatus(order: AdminOrderRow, status: string) {
    this.http.patch(`${API_URL}/admin/orders/${order.id}`, { status }).subscribe({
      next: () => {
        this.toast.success(`Order #${order.id} marked as ${status}`);
        this.orders.reload();
        this.stats.reload(); // revenue excludes cancelled/refunded orders
      },
      error: (err) => this.toast.error(errorMessage(err)),
    });
  }
}
