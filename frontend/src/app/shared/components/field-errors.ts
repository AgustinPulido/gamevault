/**
 * field-errors.ts — prints the validation errors of ONE signal-form field,
 * but only after the user has touched it (left the input) or tried to submit.
 *
 *   <input [formField]="loginForm.email" />
 *   <app-field-errors [field]="loginForm.email" />
 *
 * A FieldTree is a function: calling it — field() — returns its FieldState,
 * which exposes signals like touched() and errors().
 */
import { Component, input } from '@angular/core';
import { FieldTree } from '@angular/forms/signals';

@Component({
  selector: 'app-field-errors',
  template: `
    @if (field()().touched()) {
      @for (error of field()().errors(); track error.kind) {
        <span class="error">{{ error.message }}</span>
      }
    }
  `,
  styles: `
    :host { display: contents; }
    .error { color: var(--danger); font-size: 0.8rem; }
  `,
})
export class FieldErrors {
  readonly field = input.required<FieldTree<unknown>>();
}
