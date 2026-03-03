import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");
  const targetId = req.nextUrl.searchParams.get("targetId");
  if (!username || !targetId) {
    return NextResponse.json({ error: "Missing username or targetId" }, { status: 400 });
  }

  const url = `https://api.national-digital.getnevis.net/nevisfido/token/dispatch/status/?username=${username}&targetId=${targetId}`;
  console.log("[confirm-status] calling:", url);
  console.log("[confirm-status] NEVIS_API_KEY present:", !!process.env.NEVIS_API_KEY);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.NEVIS_API_KEY}` },
    });

    const rawText = await res.text();
    console.log("[confirm-status] HTTP", res.status, "raw body:", rawText.slice(0, 500));

    // If Nevis returned non-JSON (e.g. HTML error page) surface it clearly
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: `Nevis returned non-JSON (HTTP ${res.status})`, body: rawText.slice(0, 300) },
        { status: 502 }
      );
    }

    console.log("[confirm-status] parsed status field:", data.status);
    return NextResponse.json({ status: data.status, _raw: data });
  } catch (err: any) {
    console.error("[confirm-status] network error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
