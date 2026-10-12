/**
 * keys.js — generates fake product activation keys like "7KQ2M-X9P4T-LW3ZA".
 * A real store would get these from the publisher; here they are mock data.
 */
import { randomInt } from 'node:crypto';

// No 0/O or 1/I so keys are easy to read.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateActivationKey() {
  const group = () =>
    Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `${group()}-${group()}-${group()}`;
}
