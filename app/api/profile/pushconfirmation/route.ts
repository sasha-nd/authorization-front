import { NextResponse } from "next/server";

// Correct endpoint: GET with username + targetId (dispatch targetId, not the QR token UUID)
// The QR token UUID (tokenData.token) is the FIDO auth token, NOT the status poll identifier.
// Status polling uses: /nevisfido/token/dispatch/status/?username=X&targetId=Y
const NEVIS_STATUS_URL = "https://login.national-digital.getnevis.net/nevisfido/token/dispatch/status/";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    // Support both old ?pushId= (UUID) and new ?username=&targetId= params
    const pushId = url.searchParams.get("pushId");
    const username = url.searchParams.get("username");
    const targetId = url.searchParams.get("targetId");

    const NEVIS_API_KEY = process.env.NEVIS_API_KEY;
    if (!NEVIS_API_KEY) throw Error("Nevis API token not configured");

    let fetchUrl: string;
    if (username && targetId) {
      fetchUrl = `${NEVIS_STATUS_URL}?username=${username}&targetId=${targetId}`;
    } else if (pushId) {
      // Legacy: pushId was used as targetId — try as username+targetId fallback
      fetchUrl = `${NEVIS_STATUS_URL}?pushId=${pushId}`;
    } else {
      throw Error("Missing username+targetId or pushId");
    }

    console.log("[pushconfirmation] calling:", fetchUrl);

    const res = await fetch(fetchUrl, {
      headers: {
        Authorization: `Bearer ${NEVIS_API_KEY}`,
      },
    });

    const rawText = await res.text();
    console.log("[pushconfirmation] HTTP", res.status, "raw:", rawText.slice(0, 500));

    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: `Nevis returned non-JSON (HTTP ${res.status})`, body: rawText.slice(0, 300) },
        { status: 502 }
      );
    }

    console.log("[pushconfirmation] parsed:", data);
    // Normalize: Nevis returns { status: "approved" | "pending" | ... }
    // Map to { confirmed: true/false } for frontend compatibility
    const confirmed = data.status === "approved";
    return NextResponse.json({ ...data, confirmed });
  } catch (err: any) {
    console.error("[pushconfirmation] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}