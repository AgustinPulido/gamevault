/**
 * toast-container.ts — renders the notifications stored in ToastService.
 * Placed ONCE in app.html; any component can then call toast.success('...').
 */
import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  template: `
    <!-- aria-live makes screen readers announce new toasts -->
    <div class="stack" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class]="t.type">
          <span class="icon">
            {{ t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'error' : 'info' }}
          </span>
          <span class="msg">{{ t.message }}</span>
          <button type="button" (click)="toast.dismiss(t.id)" aria-label="Close">
            <span class="icon">close</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .stack {
      position: fixed; right: 20px; bottom: 20px; z-index: 1000;
      display: flex; flex-direction: column; gap: 10px; max-width: min(380px, calc(100vw - 40px));
    }
    .toast {
      display: flex; align-items: center; gap: 10px; padding: 12px 14px;
      background: var(--surface-2); border: 1px solid var(--border); border-left: 4px solid var(--accent);
      border-radius: var(--radius-sm); box-shadow: var(--shadow);
      animation: slide-in 0.25s ease-out;
    }
    .toast.success { border-left-color: var(--success); .icon:first-child { color: var(--success); } }
    .toast.error { border-left-color: var(--danger); .icon:first-child { color: var(--danger); } }
    .msg { flex: 1; font-size: 0.9rem; }
    button { background: none; border: 0; color: var(--text-muted); cursor: pointer; padding: 0; }
    @keyframes slide-in { from { transform: translateX(30px); opacity: 0; } }
  `,
})
export class ToastContainer {
  protected readonly toast = inject(ToastService);
}
