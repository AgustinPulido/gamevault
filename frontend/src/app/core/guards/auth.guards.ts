/**
 * auth.guards.ts
 * ---------------------------------------------------------------------------
 * GUARDS decide whether the router may open a page. They return:
 *   true      -> go ahead
 *   UrlTree   -> redirect somewhere else instead
 * Used in app.routes.ts with `canActivate: [authGuard]`.
 *
 * NOTE: guards are a UX feature, not security. The real protection is in the
 * backend, which checks the token on every request.
 * ---------------------------------------------------------------------------
 */
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Only logged-in users. Guests go to /login and come back afterwards. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() || router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Only admins. */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAdmin()) return true;
  return auth.isLoggedIn()
    ? router.createUrlTree(['/'])
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Only guests (e.g. no reason to show /login when already logged in). */
export const guestGuard: CanActivateFn = () => {
  return !inject(AuthService).isLoggedIn() || inject(Router).createUrlTree(['/']);
};
