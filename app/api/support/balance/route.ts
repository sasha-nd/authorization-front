import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getBalance } from "@/lib/balanceStore";

/**
 * GET /api/support/balance?sub=<userExtId>
 * Returns the balance for a specific user (support access required)
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.scopes?.includes("support")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const sub = searchParams.get("sub");
  
  if (!sub) {
    return NextResponse.json({ error: "Missing sub parameter" }, { status: 400 });
  }

  const balanceCents = getBalance(sub);
  return NextResponse.json({ sub, balanceCents });
}
