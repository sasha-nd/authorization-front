// /app/api/dispatch-qr/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.dispatcher || !body.getUafRequest?.context) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Call Nevis API
    const nevisRes = await fetch(
      "https://api.national-digital.getnevis.net/nevisfido/token/dispatch/authentication/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!nevisRes.ok) {
      const text = await nevisRes.text();
      console.error("Nevis API error:", text);
      return NextResponse.json({ error: text }, { status: nevisRes.status });
    }

    const nevisData = await nevisRes.json();

    // Make sure the response exists
    const qrBase64 = nevisData.dispatcherInformation?.response;
    if (!qrBase64) {
      return NextResponse.json({ error: "No QR returned from Nevis" }, { status: 500 });
    }

    // Return base64 PNG to frontend
    return NextResponse.json({ qrBase64 });
  } catch (err) {
    console.error("Internal server error in dispatch-qr:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}