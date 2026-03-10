import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getTransactions, addTransaction, Transaction } from "@/lib/transactionStore";

/**
 * GET /api/transactions
 * Returns { transactions: Transaction[] } for the authenticated user.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.sub) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const sub = session.user.sub;
  return NextResponse.json({ transactions: getTransactions(sub) });
}

/**
 * POST /api/transactions
 * Body: { type, amount, remarks?, ... } — adds a new transaction
 * Returns { transactions: Transaction[] }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.sub) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const sub = session.user.sub;

  let body: Partial<Transaction>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate required fields
  if (!body.type || typeof body.amount !== "number") {
    return NextResponse.json(
      { error: "type and amount are required" },
      { status: 400 }
    );
  }

  // Create the transaction
  const transaction: Transaction = {
    transfer_id: body.transfer_id ?? `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: body.type,
    transfer_date: body.transfer_date ?? new Date().toISOString(),
    amount: body.amount,
    status: body.status ?? "completed",
    from_account_id: body.from_account_id,
    to_account_id: body.to_account_id,
    remarks: body.remarks,
    supportInitiated: body.supportInitiated,
    supportTimestamp: body.supportTimestamp,
  };

  const updated = addTransaction(sub, transaction);
  return NextResponse.json({ transactions: updated });
}
