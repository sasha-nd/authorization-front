// /app/api/profile/update/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

/**
 * POST /api/profile/update/save
 * 
 * Handles self-service user profile updates with 2FA confirmation.
 * Flow: Send push/QR → Poll for user confirmation → Update profile in NevisIDM
 * Uses user's own access token with NevisIDM Core API.
 */
export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  const { sub, sessionId, pushSessionId, onlyPush, dispatchTargetId, ...updates } = body;

    if (!sub) {
      return NextResponse.json({ error: "Missing user ID (sub)" }, { status: 400 });
    }

    // 1️⃣ Send push notification if requested
    if (onlyPush) {
      const pushRes = await fetch(
        "https://api.national-digital.getnevis.net/nevisfido/token/dispatch/authentication/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEVIS_API_KEY}`,
          },
          body: JSON.stringify({
            dispatchTargetId,
            dispatcher: "firebase-cloud-messaging",
            dispatchInformation: {
              notification: { title: "Confirm profile update" },
              data: {},
            },
            getUafRequest: {
              context: JSON.stringify({
                username: sub,
                transaction: [
                  {
                    contentType: "text/plain",
                    content: btoa("Please confirm your profile changes"),
                  },
                ],
              }),
              op: "Auth",
            },
          }),
        }
      );

      if (!pushRes.ok) {
        const text = await pushRes.text();
        throw Error(`Push dispatch failed: ${text}`);
      }

      // Push request succeeded, return immediately
      return NextResponse.json({ pushSent: true });
    }

    // 2️⃣ Poll for phone confirmation before updating
    // Poll BOTH QR sessionId and push sessionId - user can approve via either method
    if (!sessionId && !pushSessionId) {
      return NextResponse.json({ error: "Missing sessionId or pushSessionId for status polling" }, { status: 400 });
    }

    let confirmed = false;
    for (let i = 0; i < 20; i++) {
      // Check both sessions in parallel
      const checks = [];
      
      if (sessionId) {
        checks.push(
          fetch(`https://api.national-digital.getnevis.net/nevisfido/status`, {
            method: "POST",
            headers: { 
              "Authorization": `Bearer ${process.env.NEVIS_API_KEY}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({ sessionId })
          }).then(r => r.json())
        );
      }

      if (pushSessionId) {
        checks.push(
          fetch(`https://api.national-digital.getnevis.net/nevisfido/status`, {
            method: "POST",
            headers: { 
              "Authorization": `Bearer ${process.env.NEVIS_API_KEY}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({ sessionId: pushSessionId })
          }).then(r => r.json())
        );
      }

      const results = await Promise.all(checks);
      
      // If either session succeeded, we're confirmed
      if (results.some(data => data.status === "succeeded")) {
        confirmed = true;
        break;
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!confirmed) throw Error("Push notification not confirmed by user");

    // 3️⃣ Update profile using Core API with user's own access token
    // Users with SelfAdmin role can update their own profile
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      throw new Error("No access token in session");
    }
    
    const clientExtId = process.env.NEVI_IDM_CLIENT_EXTID;
    const userAccessToken = session.accessToken;
    
    // Fetch current version for optimistic locking
    const getUserUrl = `https://api.national-digital.getnevis.net/nevisidm/api/core/v1/${clientExtId}/users/${sub}`;
    const getUserRes = await fetch(getUserUrl, {
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
        Accept: "application/json",
      },
    });
    
    if (!getUserRes.ok) {
      const getUserText = await getUserRes.text();
      throw new Error(`Failed to fetch user for version: ${getUserText}`);
    }
    
    const currentUser = await getUserRes.json();
    console.log("[profile/update] Current user structure from GET:", JSON.stringify(currentUser, null, 2));
    
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
    
    if (updates.email !== undefined || updates.phone !== undefined) {
      patchPayload.contacts = {
        email: updates.email ?? currentUser.contacts?.email,
        telephone: updates.phone ?? currentUser.contacts?.telephone,
      };
    }
    
    const patchUrl = `https://api.national-digital.getnevis.net/nevisidm/api/core/v1/${clientExtId}/users/${sub}`;
    console.log("[profile/update] PATCH to Core API (user's own token):", { url: patchUrl, payload: patchPayload });
    
    const updateRes = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(patchPayload),
    });
    const updateText = await updateRes.text();
    console.log("[profile/update] Core API PATCH response:", updateText);
    if (!updateRes.ok) {
      throw Error(`Core API PATCH failed (user token): ${updateText}`);
    }
    let updatedData;
    try {
      updatedData = JSON.parse(updateText);
    } catch {
      updatedData = updateText;
    }
    return NextResponse.json({
      success: true,
      data: updatedData,
      coreRequest: { url: patchUrl, payload: patchPayload },
      coreResponse: updateText
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Update failed" }, { status: 500 });
  }
}