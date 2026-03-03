import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");
  if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 });

  try {
    // Call Nevis API from the server
    const res = await fetch(
      `https://login.national-digital.getnevis.net/nevisfido/token/dispatch/targets/?username=${username}`,
      {
        headers: {
          "Authorization": `Bearer ${process.env.NEVIS_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) throw Error(`Nevis API error! status: ${res.status}`);

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Failed to fetch dispatch target:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}