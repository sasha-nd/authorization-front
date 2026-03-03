import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.idToken) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  // Decode sub from ID token
  const { jwtDecode } = await import("jwt-decode");
  const decoded: { sub: string } = jwtDecode(session.idToken);
  const username = decoded.sub;

  try {
    // 1️⃣ Get dispatch targets
    const targetsRes = await fetch(
      `https://api.national-digital.getnevis.net/nevisfido/token/dispatch/targets/?username=${username}`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    if (!targetsRes.ok) throw Error(`Failed to fetch targets: HTTP ${targetsRes.status}`);
    const targetsData = await targetsRes.json();
    const dispatchTargets = targetsData.dispatchTargets ?? [];

    if (dispatchTargets.length === 0) {
      return NextResponse.json({ error: "No dispatch targets found" }, { status: 404 });
    }

    // 2️⃣ Pick the first target for now
    const dispatchTargetId = dispatchTargets[0].id;

    // 3️⃣ Send push notification to authentication endpoint
    const pushPayload = {
      dispatchTargetId,
      dispatcher: "firebase-cloud-messaging",
      dispatchInformation: {
        notification: {
          title: "Nevis Workshop Bank - Confirm action by Support personnel",
        },
        data: {},
      },
      getUafRequest: {
        context: JSON.stringify({
          username,
          transaction: [
            {
              contentType: "text/plain",
              content: "Q29uZmlybSB1c2VyIG5hbWUgY2hhbmdlLg==", // Base64 of "Confirm user name change."
            },
          ],
        }),
        op: "Auth",
      },
    };

    const pushRes = await fetch(
      `https://api.national-digital.getnevis.net/nevisfido/token/dispatch/authentication/`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pushPayload),
      }
    );

    const pushData = await pushRes.json();
    if (!pushRes.ok) throw Error(`Push failed: HTTP ${pushRes.status} - ${JSON.stringify(pushData)}`);

    return NextResponse.json({
      message: "Dispatch and push notification sent successfully",
      dispatchTargets,
      pushResponse: pushData,
    });
  } catch (err: any) {
    console.error("Dispatch API error:", err);
    return NextResponse.json({ error: err.message || "Fetch failed" }, { status: 500 });
  }
}