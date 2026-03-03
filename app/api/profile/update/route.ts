import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const profile = await req.json();
    const username = profile.sub;

    // 1️⃣ Push changes to NevisIDM
    const nevisRes = await fetch(
      `https://api.national-digital.getnevis.net/nevisidm/users/${username}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${process.env.NEVI_IDM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profile),
      }
    );

    if (!nevisRes.ok) {
      const text = await nevisRes.text();
      throw Error(`NevisIDM update failed: ${text}`);
    }

    // 2️⃣ Send push notification to the user
    const pushRes = await fetch(
      "https://api.national-digital.getnevis.net/nevisfido/token/dispatch/authentication/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEVI_IDM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dispatchTargetId: "{{dispatchTargetId}}", // get the correct targetId here
          dispatcher: "firebase-cloud-messaging",
          dispatchInformation: {
            notification: {
              title: "Nevis Workshop Bank - Confirm profile update",
            },
            data: {},
          },
          getUafRequest: {
            context: JSON.stringify({
              username,
              transaction: [
                {
                  contentType: "text/plain",
                  content: "UGxlYXNlIGNvbmZpcm0geW91ciBjaGFuZ2VzLg==", // Base64 example
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
      throw Error(`Push notification failed: ${text}`);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Update failed" }, { status: 500 });
  }
}