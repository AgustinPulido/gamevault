/**
 * toast.service.ts — small pop-up notifications ("Added to cart ✓").
 * ---------------------------------------------------------------------------
 * A SERVICE is a class that holds logic/state shared by many components.
 * `providedIn: 'root'` = Angular creates ONE instance for the whole app
 * (a "singleton"), and any component can get it with `inject(ToastService)`.
 *
 * State is kept in a SIGNAL: a value that notifies Angular when it changes,
 * so every template that reads it updates automatically.
 * ---------------------------------------------------------------------------
 */
import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;

  // `signal()` is writable internally; we expose a read-only view so
  // components can display toasts but only this service can change them.
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(message: string, type: ToastType = 'info', durationMs = 3500) {
    const toast: Toast = { id: this.nextId++, type, message };
    // Signals are immutable-friendly: create a NEW array instead of push().
    this._toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), durationMs);
  }

  success(message: string) { this.show(message, 'success'); }
  error(message: string) { this.show(message, 'error', 5000); }

  dismiss(id: number) {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
