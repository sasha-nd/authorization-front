// /app/api/profile/update/save/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  const { sub, onlyPush, dispatchTargetId, ...updates } = body;

    if (!sub || !dispatchTargetId) {
      return NextResponse.json({ error: "Missing user ID (sub) or dispatchTargetId" }, { status: 400 });
    }

    // 1️⃣ Send push notification if requested
    if (onlyPush) {
      const pushRes = await fetch(
        "https://api.national-digital.getnevis.net/nevisfido/token/dispatch/authentication/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEVI_FIDO_TOKEN}`,
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
    let confirmed = false;
    for (let i = 0; i < 20; i++) {
      const statusRes = await fetch(
        `https://api.national-digital.getnevis.net/nevisfido/token/dispatch/status/?username=${sub}&targetId=${dispatchTargetId}`,
        {
          headers: { Authorization: `Bearer ${process.env.NEVI_FIDO_TOKEN}` },
        }
      );

      const statusData = await statusRes.json();
      if (statusData.status === "approved") {
        confirmed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!confirmed) throw Error("Push notification not confirmed by user");

    // 3️⃣ Push updates to NevisIDM using PATCH and required payload
    const clientExtId = process.env.NEVI_IDM_CLIENT_EXTID;
    const extId = sub;
    const patchPayload = {
      loginId: updates.loginId,
      address: updates.address,
      gender: updates.gender,
      modificationComment: updates.modificationComment,
      sex: updates.sex,
      languageCode: updates.languageCode,
      birthDate: updates.birthDate,
      version: updates.version,
      userState: updates.userState,
      name: updates.name,
      validity: updates.validity,
      properties: updates.properties,
      contacts: updates.contacts,
      remarks: updates.remarks,
    };
    const patchUrl = `https://api.national-digital.getnevis.net/nevisidm/api/core/v1/${clientExtId}/users/${extId}`;
    console.log("PATCH to NevisIDM:", { url: patchUrl, payload: patchPayload });
    const updateRes = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NEVI_IDM_TOKEN}`,
      },
      body: JSON.stringify(patchPayload),
    });
    const updateText = await updateRes.text();
    console.log("NevisIDM PATCH response:", updateText);
    if (!updateRes.ok) {
      throw Error(`NevisIDM PATCH failed: ${updateText}`);
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
      patchRequest: { url: patchUrl, payload: patchPayload },
      patchResponse: updateText
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Update failed" }, { status: 500 });
  }
}