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
    console.log("[profile/update] Updates received:", updates);
    
    // Build payload using the NESTED structure that NevisIDM Core API expects
    const patchPayload: any = {
      version: currentUser.version, // Required for optimistic locking
    };
    
    // Check if name fields changed (given_name or family_name)
    const currentFirstName = currentUser.name?.firstName || "";
    const currentFamilyName = currentUser.name?.familyName || "";
    const newFirstName = updates.given_name?.trim() || "";
    const newFamilyName = updates.family_name?.trim() || "";
    
    if (newFirstName !== currentFirstName || newFamilyName !== currentFamilyName) {
      patchPayload.name = {
        firstName: newFirstName || currentFirstName,
        familyName: newFamilyName || currentFamilyName,
      };
      console.log("[profile/update] Name changed - adding to payload:", patchPayload.name);
    }
    
    // Check if contact fields changed (email or phone)
    const currentEmail = currentUser.contacts?.email || "";
    const currentPhone = currentUser.contacts?.telephone || "";
    const newEmail = updates.email?.trim() || "";
    const newPhone = updates.phone?.trim() || "";
    
    // Only include fields that ACTUALLY changed — don't re-send unchanged fields
    // (re-sending an existing phone value can fail if it doesn't match NevisIDM's current regex)
    const contacts: any = {};
    if (newEmail && newEmail !== currentEmail) contacts.email = newEmail;
    if (newPhone && newPhone !== currentPhone) contacts.telephone = newPhone;
    
    if (Object.keys(contacts).length > 0) {
      patchPayload.contacts = contacts;
      console.log("[profile/update] Contacts changed - adding to payload:", patchPayload.contacts);
    }
    
    // Check if address changed
    const currentAddress = currentUser.address?.addressline1 || "";
    const newAddress = updates.address?.trim() || "";
    
    if (newAddress !== currentAddress) {
      patchPayload.address = {
        addressline1: newAddress || currentAddress,
      };
      console.log("[profile/update] Address changed - adding to payload:", patchPayload.address);
    }
    
    // If nothing changed, don't send the request
    if (Object.keys(patchPayload).length === 1) {
      console.log("[profile/update] No changes detected, skipping PATCH");
      return NextResponse.json({ success: true, message: "No changes to save" });
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