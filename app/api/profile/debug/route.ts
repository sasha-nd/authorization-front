import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

// Debug endpoint to see what NevisIDM returns for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.sub || !session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const clientExtId = process.env.NEVI_IDM_CLIENT_EXTID;
    const sub = session.user.sub;
    const userAccessToken = session.accessToken;

    const getUserUrl = `https://api.national-digital.getnevis.net/nevisidm/api/core/v1/${clientExtId}/users/${sub}`;
    
    console.log("[profile/debug] Fetching user from:", getUserUrl);
    
    const getUserRes = await fetch(getUserUrl, {
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
        Accept: "application/json",
      },
    });

    if (!getUserRes.ok) {
      const errorText = await getUserRes.text();
      return NextResponse.json({ 
        error: "Failed to fetch user",
        status: getUserRes.status,
        statusText: getUserRes.statusText,
        response: errorText
      }, { status: getUserRes.status });
    }

    const currentUser = await getUserRes.json();
    
    return NextResponse.json({
      success: true,
      user: currentUser,
      // Show which fields exist
      availableFields: Object.keys(currentUser),
    });
    
  } catch (err: any) {
    console.error("[profile/debug] Error:", err);
    return NextResponse.json({ 
      error: err.message,
      stack: err.stack 
    }, { status: 500 });
  }
}
