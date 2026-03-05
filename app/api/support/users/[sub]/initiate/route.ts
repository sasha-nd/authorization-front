import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

/**
 * POST /api/support/users/[sub]/initiate
 *
 * Called by the support portal to:
 *  - Fetch the target user's dispatch target
 *  - Send a push notification + QR to the USER's device (not the support person)
 *  - Return the QR base64 and sessionId so the frontend can poll for confirmation
 *
 * Body: { message: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sub: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.scopes?.includes("support")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.NEVIS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing NEVIS_API_KEY" }, { status: 500 });
  }

  const { message } = await req.json();
  if (!message) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  // Await params in Next.js 15+
  const { sub } = await params;
  const username = sub;

  try {
    // 1. Fetch the USER's dispatch target
    const targetsRes = await fetch(
      `https://login.national-digital.getnevis.net/nevisfido/token/dispatch/targets?username=${username}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    const targetsData = await targetsRes.json();
    if (!targetsRes.ok || !targetsData.dispatchTargets?.length) {
      return NextResponse.json(
        { error: "No dispatch targets found for this user", details: targetsData },
        { status: 500 }
      );
    }
    const dispatchTargetId: string = targetsData.dispatchTargets[0].id;

    // 2. Request a QR code dispatched to the USER's device
    const qrPayload = {
      dispatchTargetId,
      dispatcher: "png-qr-code",
      dispatchInformation: {
        data: { attributeName: message },
      },
      getUafRequest: {
        op: "Auth",
        context: JSON.stringify({
          username,
          transaction: [
            {
              contentType: "text/plain",
              content: Buffer.from(message).toString("base64"),
            },
          ],
        }),
      },
    };

    const qrRes = await fetch(
      "https://login.national-digital.getnevis.net/nevisfido/token/dispatch/authentication",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(qrPayload),
      }
    );
    const qrData = await qrRes.json();
    if (!qrRes.ok || !qrData.dispatcherInformation?.response) {
      return NextResponse.json(
        { error: "Failed to get QR from Nevis", details: qrData },
        { status: 500 }
      );
    }

    // 3. Also push the notification to the USER's authenticator app
    const pushPayload = {
      dispatchTargetId,
      dispatcher: "firebase-cloud-messaging",
      dispatchInformation: {
        notification: { title: message },
        data: {},
      },
      getUafRequest: {
        op: "Auth",
        context: JSON.stringify({
          username,
          transaction: [
            {
              contentType: "text/plain",
              content: Buffer.from(message).toString("base64"),
            },
          ],
        }),
      },
    };

    const pushRes = await fetch(
      "https://api.national-digital.getnevis.net/nevisfido/token/dispatch/authentication/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pushPayload),
      }
    );

    const pushData = await pushRes.json();
    console.log("[support/initiate] QR sessionId:", qrData.sessionId);
    console.log("[support/initiate] Push sessionId:", pushData.sessionId);

    // QR and push create separate sessions - return both for polling
    return NextResponse.json({
      dispatchTargetId,
      qrBase64: qrData.dispatcherInformation.response,
      sessionId: qrData.sessionId, // QR session
      pushSessionId: pushData.sessionId, // Push session
    });
  } catch (err: any) {
    console.error("Support initiate error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
