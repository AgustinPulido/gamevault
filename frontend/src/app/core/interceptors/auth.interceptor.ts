/**
 * auth.interceptor.ts
 * ---------------------------------------------------------------------------
 * An INTERCEPTOR sits between the app and the network: EVERY HttpClient
 * request passes through it. We use it to:
 *   1. attach "Authorization: Bearer <token>" when the user is logged in;
 *   2. detect a 401 (token expired) and log the user out.
 * Without it, every service would have to add the header by hand.
 * ---------------------------------------------------------------------------
 */
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;

  // Requests are immutable, so we clone them to add a header.
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // A 401 on a request that HAD a token means the session is no longer
      // valid. (A 401 on /auth/login just means "wrong password".)
      if (err.status === 401 && token && !req.url.includes('/auth/')) {
        auth.logout();
      }
      return throwError(() => err);
    }),
  );
};
