import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Return full session details including token claims
  return NextResponse.json({
    session: session,
    user: session.user,
    scopes: session.scopes,
    accessToken: session.accessToken ? "present (hidden)" : "missing",
    idToken: session.idToken ? "present (hidden)" : "missing",
  }, { status: 200 });
}
