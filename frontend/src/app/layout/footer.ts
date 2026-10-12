/**
 * footer.ts — page footer with links and the demo disclaimer.
 */
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  template: `
    <footer>
      <div class="container cols">
        <div>
          <div class="logo"><span class="icon filled">sports_esports</span> GameVault</div>
          <p class="muted">
            A demo e-commerce built with Angular 22, Node.js and SQLite.
            Game data, images and trailers belong to their respective owners and are
            loaded from Steam's public CDN for educational purposes only.
          </p>
        </div>
        <div>
          <h4>Store</h4>
          <a routerLink="/games">All games</a>
          <a routerLink="/games" [queryParams]="{ onSale: true, sort: 'discount' }">Deals</a>
          <a routerLink="/games" [queryParams]="{ sort: 'newest' }">New releases</a>
        </div>
        <div>
          <h4>Account</h4>
          <a routerLink="/orders">My orders</a>
          <a routerLink="/wishlist">Wishlist</a>
          <a routerLink="/cart">Cart</a>
        </div>
        <div>
          <h4>Try it</h4>
          <span class="muted">Demo user: demo&#64;gamevault.dev / demo123</span>
          <span class="muted">Admin: admin&#64;gamevault.dev / admin123</span>
          <span class="muted">Test card: 4242 4242 4242 4242</span>
          <span class="muted">Coupons: WELCOME10, GAMER20, MEGA50</span>
        </div>
      </div>
      <div class="container copy muted">© {{ year }} GameVault — not a real store, nothing is charged.</div>
    </footer>
  `,
  styles: `
    footer { border-top: 1px solid var(--border); background: var(--surface); padding: 40px 0 20px; margin-top: 40px; }
    .cols { display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr; gap: 32px; }
    .cols > div { display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; }
    h4 { font-size: 1rem; margin-bottom: 4px; }
    a { color: var(--text-muted); }
    a:hover { color: var(--text); }
    .logo { font-family: var(--font-display); font-size: 1.4rem; font-weight: 700; display: flex; gap: 6px; align-items: center; }
    .copy { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 0.8rem; }
    @media (max-width: 800px) { .cols { grid-template-columns: 1fr 1fr; } }
  `,
})
export class Footer {
  protected readonly year = new Date().getFullYear();
}
