import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { username, updates } = await req.json();

    const NEVIS_API_KEY = process.env.NEVIS_API_KEY;
    if (!NEVIS_API_KEY) throw new Error("Nevis API token not configured");

    // Replace with your actual Nevis IDM SCIM URL and user ID
    const NEVIS_IDM_UPDATE = `https://api.national-digital.getnevis.net/nevisidm/api/scim/v1/Clients/YOUR_CLIENT_ID/Users/${username}`;

    const res = await fetch(NEVIS_IDM_UPDATE, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NEVIS_API_KEY}`,
      },
      body: JSON.stringify({ Operations: [{ op: "replace", path: "", value: updates }] }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Update failed");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Update profile error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}