/**
 * header.ts — top navigation bar: logo, search, links, cart and user menu.
 */
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { CartService } from '../core/services/cart.service';
import { WishlistService } from '../core/services/wishlist.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  host: {
    // Close the user menu when clicking anywhere else on the page.
    '(document:click)': 'menuOpen.set(false)',
  },
})
export class Header {
  protected readonly auth = inject(AuthService);
  protected readonly cart = inject(CartService);
  protected readonly wishlist = inject(WishlistService);
  private readonly router = inject(Router);

  protected readonly menuOpen = signal(false);
  protected readonly mobileNavOpen = signal(false);

  /** Sends the search text to the catalog page as ?q=... */
  protected search(term: string) {
    this.mobileNavOpen.set(false);
    this.router.navigate(['/games'], { queryParams: { q: term.trim() || null } });
  }

  protected toggleMenu(event: Event) {
    event.stopPropagation(); // otherwise the document:click above closes it immediately
    this.menuOpen.update((open) => !open);
  }
}
