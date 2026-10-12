/**
 * cents.pipe.ts — formats an amount in CENTS as money.
 * ---------------------------------------------------------------------------
 * A PIPE transforms a value inside a template:
 *     {{ 5999 | cents }}   ->  $59.99
 * "pure" pipes (the default) only re-run when the input changes, so they are
 * cheap to use in lists.
 * ---------------------------------------------------------------------------
 */
import { Pipe, PipeTransform } from '@angular/core';

// Creating an Intl.NumberFormat is slow-ish, so we create it once and reuse it.
const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

@Pipe({ name: 'cents' })
export class CentsPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatter.format((value ?? 0) / 100);
  }
}
