/**
 * Server-side in-memory balance store.
 * Balances are stored in cents (integer) and keyed by user sub.
 *
 * In production you would replace this Map with a real database call,
 * but the interface (getBalance / setBalance) stays the same.
 */

const DEFAULT_BALANCE_CENTS = 1_000_000; // $10,000.00

// Module-level singleton — survives across requests within the same Node process.
const balances = new Map<string, number>();

export function getBalance(sub: string): number {
  if (balances.has(sub)) return balances.get(sub)!;
  // First access — seed with default
  balances.set(sub, DEFAULT_BALANCE_CENTS);
  return DEFAULT_BALANCE_CENTS;
}

export function setBalance(sub: string, cents: number): number {
  const clamped = Math.max(0, Math.round(cents));
  balances.set(sub, clamped);
  return clamped;
}

export function adjustBalance(sub: string, deltaCents: number): number {
  return setBalance(sub, getBalance(sub) + deltaCents);
}
