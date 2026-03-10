/**
 * Server-side in-memory transaction store.
 * Transactions are keyed by user sub.
 *
 * In production you would replace this Map with a real database call.
 */

export type Transaction = {
  transfer_id: string;
  type: string;
  transfer_date: string;
  amount: number; // cents (negative for outgoing, positive for incoming)
  status: string;
  from_account_id?: string;
  to_account_id?: string;
  remarks?: string;
  supportInitiated?: boolean; // true if this transaction was made by a support agent
  supportTimestamp?: string;  // ISO timestamp of when support initiated the action
};

// Module-level singleton — survives across requests within the same Node process
const transactions = new Map<string, Transaction[]>();

export function getTransactions(sub: string): Transaction[] {
  return transactions.get(sub) ?? [];
}

export function addTransaction(sub: string, transaction: Transaction): Transaction[] {
  const existing = transactions.get(sub) ?? [];
  const updated = [transaction, ...existing];
  transactions.set(sub, updated);
  return updated;
}

export function clearTransactions(sub: string): void {
  transactions.delete(sub);
}
