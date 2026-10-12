/**
 * app.config.ts — application-wide setup ("providers").
 * ---------------------------------------------------------------------------
 * Angular 22 apps are "zoneless" by default: change detection is driven by
 * SIGNALS, not by zone.js monkey-patching every browser event. That's why
 * all state in this project lives in signals.
 * ---------------------------------------------------------------------------
 */
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    provideRouter(
      routes,
      // Route params (:slug) and query params (?q=) are passed to the page
      // component as INPUTS automatically, e.g. `slug = input<string>()`.
      withComponentInputBinding(),
      // Scroll to top when navigating to a new page.
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      // Smooth cross-fade between pages using the browser View Transitions API.
      withViewTransitions(),
    ),

    // HttpClient + our interceptor that adds the JWT token to requests.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),

    // Runs BEFORE the app is displayed: restore the logged-in user (if any),
    // so guards already know whether the user is logged in.
    provideAppInitializer(() => inject(AuthService).restoreSession()),
  ],
};
