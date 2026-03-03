import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

// GET /api/support/users — list all users from NevisIDM
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.scopes?.includes("support")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientExtId = process.env.NEVI_IDM_CLIENT_EXTID;
  const token = process.env.NEVI_IDM_TOKEN;
  if (!clientExtId || !token) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://api.national-digital.getnevis.net/nevisidm/api/core/v1/${clientExtId}/users`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: `NevisIDM error: ${text}` }, { status: res.status });
    }
    return NextResponse.json(JSON.parse(text));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
