/**
 * app.ts — ROOT component. It's the "shell" that every page is rendered in:
 *   header (always visible) / <router-outlet> (current page) / footer / toasts
 */
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Footer } from './layout/footer';
import { Header } from './layout/header';
import { ToastContainer } from './shared/components/toast-container';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, ToastContainer],
  template: `
    <app-header />
    <main>
      <!-- The router swaps the component shown here based on the URL -->
      <router-outlet />
    </main>
    <app-footer />
    <app-toast-container />
  `,
})
export class App {}
