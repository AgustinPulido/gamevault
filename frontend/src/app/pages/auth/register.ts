/**
 * register.ts — /register — create an account (Signal Forms).
 * Shows a CROSS-FIELD validation: "confirm password" must equal "password".
 */
import { Component, inject, input, signal } from '@angular/core';
import { email, form, FormField, FormRoot, maxLength, minLength, required, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../core/api';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { FieldErrors } from '../../shared/components/field-errors';

@Component({
  selector: 'app-register',
  imports: [RouterLink, FormField, FormRoot, FieldErrors],
  templateUrl: './register.html',
  styleUrl: './auth.scss',
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly returnUrl = input<string>('/');

  protected readonly model = signal({ name: '', email: '', password: '', confirmPassword: '' });

  protected readonly registerForm = form(
    this.model,
    (path) => {
      required(path.name, { message: 'Tell us your name' });
      minLength(path.name, 2, { message: 'Name is too short' });
      maxLength(path.name, 60);
      required(path.email, { message: 'Email is required' });
      email(path.email, { message: 'Enter a valid email address' });
      required(path.password, { message: 'Choose a password' });
      minLength(path.password, 6, { message: 'Use at least 6 characters' });
      // valueOf(otherPath) reads ANOTHER field's value inside a validator.
      // The rule re-evaluates automatically when either field changes.
      validate(path.confirmPassword, ({ value, valueOf }) =>
        value() !== valueOf(path.password) ? { kind: 'mismatch', message: 'Passwords do not match' } : undefined,
      );
    },
    {
      submission: {
        action: async () => {
          const { name, email, password } = this.model();
          try {
            await firstValueFrom(this.auth.register(name, email, password));
            this.toast.success(`Welcome to GameVault, ${name}!`);
            this.router.navigateByUrl(this.returnUrl() || '/');
            return undefined;
          } catch (err) {
            return { kind: 'server', message: errorMessage(err) };
          }
        },
      },
    },
  );
}
