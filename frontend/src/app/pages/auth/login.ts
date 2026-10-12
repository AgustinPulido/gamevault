/**
 * login.ts — /login — sign-in form (Signal Forms).
 * After logging in we go back to `returnUrl` (the page that required login).
 */
import { Component, inject, input, signal } from '@angular/core';
import { email, form, FormField, FormRoot, required } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../core/api';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { FieldErrors } from '../../shared/components/field-errors';

@Component({
  selector: 'app-login',
  imports: [RouterLink, FormField, FormRoot, FieldErrors],
  templateUrl: './login.html',
  styleUrl: './auth.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** ?returnUrl=/cart -> where to go after a successful login. */
  readonly returnUrl = input<string>('/');

  protected readonly model = signal({ email: '', password: '' });
  protected readonly showPassword = signal(false);

  protected readonly loginForm = form(
    this.model,
    (path) => {
      required(path.email, { message: 'Email is required' });
      email(path.email, { message: 'Enter a valid email address' });
      required(path.password, { message: 'Password is required' });
    },
    {
      submission: {
        action: async () => {
          const { email, password } = this.model();
          try {
            const res = await firstValueFrom(this.auth.login(email, password));
            this.toast.success(`Welcome back, ${res.user.name}!`);
            this.router.navigateByUrl(this.returnUrl() || '/');
            return undefined;
          } catch (err) {
            return { kind: 'server', message: errorMessage(err) };
          }
        },
      },
    },
  );

  /** One-click demo logins (fills the form; you still press "Sign in"). */
  protected useDemo(kind: 'customer' | 'admin') {
    this.model.set(
      kind === 'admin'
        ? { email: 'admin@gamevault.dev', password: 'admin123' }
        : { email: 'demo@gamevault.dev', password: 'demo123' },
    );
  }
}
