import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");
  const targetId = req.nextUrl.searchParams.get("targetId");
  if (!username || !targetId) {
    return NextResponse.json({ error: "Missing username or targetId" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.national-digital.getnevis.net/nevisfido/token/dispatch/status/?username=${username}&targetId=${targetId}`,
      {
        headers: { Authorization: `Bearer ${process.env.NEVI_FIDO_TOKEN}` },
      }
    );
    const data = await res.json();
    return NextResponse.json({ status: data.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
