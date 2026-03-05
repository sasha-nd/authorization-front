import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

// Cache OAuth2 token to avoid repeated requests
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Gets OAuth2 access token for technical user (api-user).
 * Token is cached and reused until expiration.
 */
async function getTechnicalUserToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    console.log("[support/users] Using cached OAuth2 token");
    return cachedToken.token;
  }

  const clientId = process.env.NEVISIDM_CLIENT_ID;
  const clientSecret = process.env.NEVISIDM_CLIENT_SECRET;
  // Correct token endpoint from OpenID Connect discovery document
  const tokenEndpoint = "https://login.national-digital.getnevis.net/oauth/token";

  if (!clientId || !clientSecret) {
    throw new Error("Missing NEVISIDM_CLIENT_ID or NEVISIDM_CLIENT_SECRET");
  }

  console.log("[support/users] Requesting OAuth2 token with Client Credentials flow");

  // OAuth2 Client Credentials Grant - proper way for server-to-server authentication
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "nevis",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[support/users] OAuth2 token failed:", response.status, text);
    throw new Error(`OAuth2 token request failed: ${response.status}`);
  }

  const data = await response.json();
  console.log("[support/users] ✅ Got OAuth2 access token, expires in:", data.expires_in, "seconds");

  // Cache the token
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return data.access_token;
}

/**
 * GET /api/support/users
 * Lists all users from NevisIDM by fetching user IDs 1000-1100.
 * Requires support role. Returns transformed user objects.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.scopes?.includes("support")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientExtId = process.env.NEVI_IDM_CLIENT_EXTID;
  
  console.log("[support/users] clientExtId:", clientExtId);
  
  if (!clientExtId) {
    console.error("[support/users] Missing NEVI_IDM_CLIENT_EXTID");
    return NextResponse.json({ 
      error: "Server misconfiguration - missing NEVI_IDM_CLIENT_EXTID" 
    }, { status: 500 });
  }

  try {

    const accessToken = await getTechnicalUserToken();

    console.log("[support/users] Fetching individual users from Core API (range 1000-1100)");
    
    const startId = 1000;
    const endId = 1100;
    const userPromises = [];
    
    for (let i = startId; i <= endId; i++) {
      const extId = i.toString();
      userPromises.push(
        (async () => {
          try {
            const url = `https://api.national-digital.getnevis.net/nevisidm/api/core/v1/${clientExtId}/users/${extId}`;
            const res = await fetch(url, {
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
            });
            
            if (res.ok) {
              return await res.json();
            }
            return null;
          } catch {
            return null;
          }
        })()
      );
    }
    
    const fetchedUsers = (await Promise.all(userPromises)).filter(u => u !== null);
    console.log("[support/users] Found", fetchedUsers.length, "users in range", startId, "-", endId);
    
    // Transform the results to match frontend expectations
    const users = fetchedUsers.map((user: any) => ({
      extId: user.extId,
      loginId: user.loginId,
      userState: user.userState,
      given_name: user.name?.firstName || "",
      family_name: user.name?.familyName || "",
      name: `${user.name?.firstName || ""} ${user.name?.familyName || ""}`.trim(),
      email: user.contacts?.email || user.loginId,
      phone_number: user.contacts?.telephone || "",
      clientExtId: clientExtId,
      version: user.version,
      isTechnicalUser: user.isTechnicalUser || false,
    }));
    
    console.log("[support/users] Successfully transformed", users.length, "users");
    
    // Return in the expected format
    return NextResponse.json({
      items: users,
      _pagination: { 
        limit: 100, 
        offset: 0,
        totalResult: users.length
      }
    });
    
  } catch (err: any) {
    console.error("[support/users] Error:", err);
    return NextResponse.json({ 
      error: err.message,
      details: "Query endpoint failed - check logs for details"
    }, { status: 500 });
  }
}
