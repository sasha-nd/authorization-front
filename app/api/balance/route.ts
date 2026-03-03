import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getBalance, setBalance, adjustBalance } from "@/lib/balanceStore";

/**
 * GET /api/balance
 * Returns { sub, balanceCents } for the authenticated user.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.sub) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const sub = session.user.sub;
  return NextResponse.json({ sub, balanceCents: getBalance(sub) });
}

/**
 * PATCH /api/balance
 * Body: { balanceCents: number }   — set absolute value, OR
 *       { deltaCents: number }     — apply a relative adjustment (negative = deduct)
 * Returns { sub, balanceCents }
 */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.sub) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const sub = session.user.sub;

  let body: { balanceCents?: number; deltaCents?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let newBalance: number;
  if (typeof body.balanceCents === "number") {
    newBalance = setBalance(sub, body.balanceCents);
  } else if (typeof body.deltaCents === "number") {
    newBalance = adjustBalance(sub, body.deltaCents);
  } else {
    return NextResponse.json(
      { error: "Provide balanceCents or deltaCents" },
      { status: 400 }
    );
  }

  return NextResponse.json({ sub, balanceCents: newBalance });
}
