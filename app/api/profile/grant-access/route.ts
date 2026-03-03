import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { grantAccess, extendAccess, getGrantInfo } from "@/lib/accessGrants";

/**
 * POST /api/profile/grant-access
 * Body (optional): { extend: true } — adds 60s to current expiry instead of resetting.
 *
 * Called by the LOGGED-IN USER from their dashboard.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.sub) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userSub = session.user.sub;

  let extend = false;
  try {
    const body = await req.json();
    extend = body?.extend === true;
  } catch {
    // no body or invalid JSON — treat as a fresh grant
  }

  const grant = extend ? extendAccess(userSub) : grantAccess(userSub);

  console.log(
    `[grant-access] User ${userSub} ${extend ? "extended" : "granted"} support access until`,
    new Date(grant.expiresAt).toISOString()
  );

  return NextResponse.json({
    granted: true,
    extended: extend,
    userSub,
    grantedAt: grant.grantedAt,
    expiresAt: grant.expiresAt,
    ttlMs: grant.expiresAt - Date.now(),
  });
}

/**
 * GET /api/profile/grant-access?sub=<userSub>
 *
 * Called by SUPPORT to check if a user has an active grant.
 * Also used by the user's own dashboard to poll remaining time.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.sub) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  // Support passes ?sub= to check a target user's grant.
  // The user themselves calls without ?sub to check their own grant.
  const targetSub = url.searchParams.get("sub") ?? session.user.sub;

  // If a sub is specified and caller is not support, only allow checking own
  const isSupport = (session as any).scopes?.includes("support");
  if (targetSub !== session.user.sub && !isSupport) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const info = getGrantInfo(targetSub);
  return NextResponse.json({ userSub: targetSub, ...info });
}

/**
 * DELETE /api/profile/grant-access
 *
 * Allows the user to revoke their own grant early.
 */
export async function DELETE(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.sub) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { revokeGrant } = await import("@/lib/accessGrants");
  revokeGrant(session.user.sub);

  return NextResponse.json({ revoked: true, userSub: session.user.sub });
}
