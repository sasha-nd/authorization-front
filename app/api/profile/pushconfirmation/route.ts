import { NextResponse } from "next/server";

const NEVIS_API_STATUS = "https://api.national-digital.getnevis.net/nevisfido/status/";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pushId = url.searchParams.get("pushId");
    if (!pushId) throw Error("Missing pushId");

    const NEVIS_API_KEY = process.env.NEVIS_API_KEY;
    if (!NEVIS_API_KEY) throw Error("Nevis API token not configured");

    const res = await fetch(`${NEVIS_API_STATUS}?pushId=${pushId}`, {
      headers: {
        "Authorization": `Bearer ${NEVIS_API_KEY}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw Error("Status check failed: " + text);
    }

    const data = await res.json();
    // expected { confirmed: true/false }
    return NextResponse.json(data);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}