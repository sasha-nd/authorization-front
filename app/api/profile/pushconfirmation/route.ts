import { NextResponse } from "next/server";

// Nevis Status Service documentation:
// https://docs.nevis.net/nevisfido/reference-guide/uaf-http-api/status-service
// Endpoint: POST /nevisfido/status
// Body: {"sessionId": "uuid"}
// Returns: {"status": "succeeded"|"failed"|"clientAuthenticating"|"tokenCreated"|..., "userId": "...", ...}
const NEVIS_STATUS_URL = "https://api.national-digital.getnevis.net/nevisfido/status";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId parameter" }, { status: 400 });
    }

    const NEVIS_API_KEY = process.env.NEVIS_API_KEY;
    if (!NEVIS_API_KEY) {
      return NextResponse.json({ error: "Nevis API key not configured" }, { status: 500 });
    }

    console.log("[pushconfirmation] Checking status for sessionId:", sessionId);

    const res = await fetch(NEVIS_STATUS_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NEVIS_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[pushconfirmation] HTTP", res.status, "error:", errorText);
      return NextResponse.json(
        { error: `Nevis API error (HTTP ${res.status})`, details: errorText },
        { status: res.status }
      );
    }

    const data = await res.json();
    console.log("[pushconfirmation] Status response:", data);

    // Map Nevis status to frontend-friendly format
    // status can be: "succeeded", "failed", "clientAuthenticating", "tokenCreated", "unknown"
    const confirmed = data.status === "succeeded";
    const pending = data.status === "clientAuthenticating" || data.status === "tokenCreated";
    const failed = data.status === "failed" || data.status === "unknown";

    return NextResponse.json({
      ...data,
      confirmed,
      pending,
      failed,
    });
  } catch (err: any) {
    console.error("[pushconfirmation] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}