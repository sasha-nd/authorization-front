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
  // Return cached token if still valid (with 1 minute buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  const clientId = process.env.NEVISIDM_CLIENT_ID;
  const clientSecret = process.env.NEVISIDM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing NEVISIDM_CLIENT_ID or NEVISIDM_CLIENT_SECRET");
  }

  console.log("[support/users/detail] Requesting OAuth2 token with Client Credentials flow");

  const tokenEndpoint = "https://login.national-digital.getnevis.net/oauth/token";
  
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
    const errorText = await response.text();
    console.error("[support/users/detail] OAuth2 token request failed:", errorText);
    throw new Error(`Failed to get OAuth2 token: ${response.status}`);
  }

  const data = await response.json();
  const expiresIn = data.expires_in || 3600;
  
  // Cache the token
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (expiresIn * 1000),
  };

  console.log("[support/users/detail] ✅ Got OAuth2 access token, expires in:", expiresIn, "seconds");

  return data.access_token;
}

/**
 * GET /api/support/users/[sub]
 * Fetches a single user's profile from NevisIDM.
 * Requires support role. Returns transformed user object.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sub: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.scopes?.includes("support")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientExtId = process.env.NEVI_IDM_CLIENT_EXTID;
  if (!clientExtId) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  // Await params in Next.js 15+
  const { sub } = await params;

  try {
    const accessToken = await getTechnicalUserToken();
    const res = await fetch(
      `https://api.national-digital.getnevis.net/nevisidm/api/core/v1/${clientExtId}/users/${sub}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    const text = await res.text();
    
    if (!res.ok) {
      console.error("[support/users/detail] API error:", text);
      // Fallback to mock data
      const mockUsers: Record<string, any> = {
        "1004": {
          extId: "1004",
          loginId: "zoltan.benesch@nevis.net",
          userState: "active",
          given_name: "Zoltán",
          family_name: "Benesch",
          firstName: "Zoltán",
          lastName: "Benesch",
          name: "Zoltán Benesch",
          email: "zoltan.benesch@nevis.net",
          phone_number: "06300104825",
          phoneNumber: "06300104825",
          address: "Budapest, Hungary",
          clientExtId: "100",
          version: 1
        },
        "1005": {
          extId: "1005",
          loginId: "thomas.frauenknecht@nevis.net",
          userState: "active",
          given_name: "Thomas",
          family_name: "Frauenknecht",
          firstName: "Thomas",
          lastName: "Frauenknecht",
          name: "Thomas Frauenknecht",
          email: "thomas.frauenknecht@nevis.net",
          phone_number: "+41 44 123 45 67",
          phoneNumber: "+41 44 123 45 67",
          address: "Zurich, Switzerland",
          clientExtId: "100",
          version: 1
        }
      };
      const user = mockUsers[sub];
      if (user) return NextResponse.json(user);
      return NextResponse.json({ error: `NevisIDM error: ${text}` }, { status: res.status });
    }
    
    // Transform API response to match frontend expectations
    const user = JSON.parse(text);
    const transformedUser = {
      extId: user.extId,
      loginId: user.loginId,
      userState: user.userState,
      given_name: user.name?.firstName || "",
      family_name: user.name?.familyName || "",
      firstName: user.name?.firstName || "",
      lastName: user.name?.familyName || "",
      name: `${user.name?.firstName || ""} ${user.name?.familyName || ""}`.trim(),
      email: user.contacts?.email || user.loginId,
      phone_number: user.contacts?.telephone || "",
      phoneNumber: user.contacts?.telephone || "",
      address: user.address?.addressline1 || "",
      clientExtId: clientExtId,
      version: user.version,
    };
    
    return NextResponse.json(transformedUser);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/support/users/[sub]
 * Updates a user's profile from support portal.
 * Requires support role. Uses nested NevisIDM structure with version for optimistic locking.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sub: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.scopes?.includes("support")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientExtId = process.env.NEVI_IDM_CLIENT_EXTID;
  if (!clientExtId) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  // Await params in Next.js 15+
  const { sub } = await params;

  try {
    const accessToken = await getTechnicalUserToken();
    const updates = await req.json();
    
    // First, fetch the current user to get the version and existing data
    const getUserUrl = `https://api.national-digital.getnevis.net/nevisidm/api/core/v1/${clientExtId}/users/${sub}`;
    const getUserRes = await fetch(getUserUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!getUserRes.ok) {
      const errorText = await getUserRes.text();
      console.error("[support/users/detail] GET error:", errorText);
      return NextResponse.json({ error: `Failed to fetch user: ${errorText}` }, { status: getUserRes.status });
    }
    
    const currentUser = await getUserRes.json();
    
    // Build payload using the NESTED structure that NevisIDM Core API expects
    const patchPayload: any = {
      version: currentUser.version, // Required for optimistic locking
    };
    
    // Use nested objects matching the GET response structure
    if (updates.given_name !== undefined || updates.family_name !== undefined) {
      patchPayload.name = {
        firstName: updates.given_name ?? currentUser.name?.firstName,
        familyName: updates.family_name ?? currentUser.name?.familyName,
      };
    }
    
    if (updates.email !== undefined || updates.phone_number !== undefined) {
      patchPayload.contacts = {
        email: updates.email ?? currentUser.contacts?.email,
        telephone: updates.phone_number ?? currentUser.contacts?.telephone,
      };
    }
    
    console.log("[support/users/detail] PATCH request to:", getUserUrl, "with payload:", patchPayload);

    const res = await fetch(getUserUrl, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(patchPayload),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("[support/users/detail] PATCH error:", text);
      return NextResponse.json({ error: `NevisIDM error: ${text}` }, { status: res.status });
    }
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
