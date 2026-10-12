/**
 * not-found.ts — shown for any unknown URL (the "**" route).
 */
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <div class="container empty-state">
      <div class="code">404</div>
      <h2>Game over — page not found</h2>
      <p>The page you're looking for respawned somewhere else.</p>
      <a routerLink="/" class="btn primary">Back to the store</a>
    </div>
  `,
  styles: `
    .code {
      font-family: var(--font-display); font-size: 8rem; font-weight: 700; line-height: 1;
      background: var(--gradient); -webkit-background-clip: text; background-clip: text; color: transparent;
    }
  `,
})
export class NotFound {}
