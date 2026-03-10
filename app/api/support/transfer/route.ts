import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getBalance, adjustBalance } from "@/lib/balanceStore";
import { addTransaction, Transaction } from "@/lib/transactionStore";

/**
 * POST /api/support/transfer
 *
 * Executes a transfer on behalf of a user via the support portal.
 * - Deducts the amount from the user's balance
 * - Records a transaction with `supportInitiated: true`
 *
 * Body: { sub, amount (cents, positive), recipient, remarks? }
 * Requires support role.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.scopes?.includes("support")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { sub?: string; amount?: number; recipient?: string; remarks?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sub, amount, recipient, remarks } = body;

  if (!sub || typeof amount !== "number" || amount <= 0 || !recipient) {
    return NextResponse.json(
      { error: "sub, amount (positive cents), and recipient are required" },
      { status: 400 }
    );
  }

  // Check sufficient funds
  const currentBalance = getBalance(sub);
  if (currentBalance < amount) {
    return NextResponse.json(
      { error: "Insufficient funds", balanceCents: currentBalance },
      { status: 400 }
    );
  }

  // Deduct balance
  const newBalance = adjustBalance(sub, -amount);

  // Record the transaction on the USER's transaction history
  const supportAgent = session.user?.email || session.user?.name || "support";
  const now = new Date().toISOString();

  const transaction: Transaction = {
    transfer_id: `support-tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: `Transfer to ${recipient}`,
    transfer_date: now,
    amount: -amount, // negative = outgoing
    status: "completed",
    to_account_id: recipient,
    remarks: remarks || undefined,
    supportInitiated: true,
    supportTimestamp: now,
  };

  const transactions = addTransaction(sub, transaction);

  console.log(`[support/transfer] Agent ${supportAgent} transferred ${amount} cents from user ${sub} to ${recipient}`);

  return NextResponse.json({
    success: true,
    newBalanceCents: newBalance,
    transaction,
    totalTransactions: transactions.length,
  });
}
