import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { username, transaction, dispatchTargetId } = await req.json();

    if (!dispatchTargetId) {
      throw new Error("dispatchTargetId is required");
    }

    const NEVIS_API_KEY = process.env.NEVIS_API_KEY;
    if (!NEVIS_API_KEY) throw new Error("Nevis API token not configured");

    // ✅ Correct Nevis authentication endpoint
    const NEVIS_API_DISPATCH_AUTH =
      "https://api.national-digital.getnevis.net/nevisfido/token/dispatch/authentication";

    // Body required by Nevis docs
    const bodyPayload = {
      dispatchTargetId,
      dispatcher: "firebase-cloud-messaging",
      dispatchInformation: { notification: { title: transaction || "Auth Request" }, data: {} },
      getUafRequest: {
        op: "Auth",
        context: JSON.stringify({ username, transaction }),
      },
    };

    console.log("Sending push with payload:", bodyPayload);

    const res = await fetch(NEVIS_API_DISPATCH_AUTH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NEVIS_API_KEY}`,
      },
      body: JSON.stringify(bodyPayload),
    });

    const text = await res.text();
    console.log("Nevis response (raw):", text);

    if (!res.ok) {
      throw new Error(`Push dispatch failed (HTTP ${res.status}): ${text}`);
    }

    const data = JSON.parse(text);

    // Nevis push dispatch returns { dispatchResult: "dispatched" } on success
    if (data.dispatchResult && data.dispatchResult !== "dispatched") {
      throw new Error(`Push dispatch failed: ${text}`);
    }
    if (!res.ok) {
      throw new Error(`Push dispatch failed (HTTP ${res.status}): ${text}`);
    }

    // Return sessionId or token to frontend to poll status
    return NextResponse.json({ pushId: data.sessionId ?? data.token ?? data.dispatchResult });
  } catch (err: any) {
    console.error("Push dispatch error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}