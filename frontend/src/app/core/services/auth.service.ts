/**
 * auth.service.ts — who is logged in?
 * ---------------------------------------------------------------------------
 * - Stores the JWT token in localStorage so the session survives a reload.
 * - Exposes the current user as a signal, plus derived (computed) signals
 *   such as `isLoggedIn` and `isAdmin` that templates and guards can read.
 * ---------------------------------------------------------------------------
 */
import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, tap } from 'rxjs';
import { API_URL } from '../api';
import { AuthResponse, User } from '../models/models';

const TOKEN_KEY = 'gamevault_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();

  // computed() = a signal whose value is DERIVED from other signals.
  // It recalculates automatically whenever `_user` changes.
  readonly isLoggedIn = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.role === 'admin');

  /** The raw token, read by the HTTP interceptor. */
  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Called once when the app starts (see app.config.ts). If a token was saved
   * in a previous visit, ask the backend who it belongs to. If the token is
   * expired or invalid, forget it.
   */
  async restoreSession(): Promise<void> {
    if (!this.token) return;
    try {
      const user = await firstValueFrom(this.http.get<User>(`${API_URL}/auth/me`));
      this._user.set(user);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  login(email: string, password: string) {
    return this.http
      .post<AuthResponse>(`${API_URL}/auth/login`, { email, password })
      // tap() runs a side effect without changing the response.
      .pipe(tap((res) => this.saveSession(res)));
  }

  register(name: string, email: string, password: string) {
    return this.http
      .post<AuthResponse>(`${API_URL}/auth/register`, { name, email, password })
      .pipe(tap((res) => this.saveSession(res)));
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    this._user.set(null);
    this.router.navigateByUrl('/');
  }

  private saveSession({ token, user }: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, token);
    this._user.set(user);
  }
}
