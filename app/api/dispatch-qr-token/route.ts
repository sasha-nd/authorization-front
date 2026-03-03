
// Dynamic import workaround for otplib
import { NextResponse } from "next/server";
import QRCode from "qrcode";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = body.username;
    if (!username) {
      return NextResponse.json({ error: "Missing username" }, { status: 400 });
    }

    // 1️⃣ Get dispatchTargetId
    const apiKey = process.env.NEVIS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing NEVIS_API_KEY" }, { status: 500 });
    }
    const targetsRes = await fetch(
      `https://login.national-digital.getnevis.net/nevisfido/token/dispatch/targets?username=${username}`,
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    const targetsData = await targetsRes.json();
    if (!targetsRes.ok || !targetsData.dispatchTargets || !targetsData.dispatchTargets.length) {
      return NextResponse.json({ error: "No dispatch targets found", details: targetsData }, { status: 500 });
    }
    const dispatchTargetId = targetsData.dispatchTargets[0].id;

    // 2️⃣ Call Nevis API to create and dispatch token
    const payload = {
      dispatchTargetId,
      dispatcher: "png-qr-code",
      dispatchInformation: {
        data: {
          attributeName: "some additional data to be included in the QR code e.g. for number matching (flexibility)"
        }
      },
      getUafRequest: {
        op: "Auth",
        context: JSON.stringify({
          username,
          transaction: [
            {
              contentType: "text/plain",
              content: Buffer.from("approve modification of user properties?").toString("base64"),
            },
          ],
        }),
      },
    };
    const tokenRes = await fetch(
      `https://login.national-digital.getnevis.net/nevisfido/token/dispatch/authentication`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.dispatcherInformation || !tokenData.dispatcherInformation.response) {
      return NextResponse.json({ error: "Failed to get QR from Nevis", details: tokenData }, { status: 500 });
    }

    // 3️⃣ Send push notification to user's authenticator app
    const pushMessage = "approve modification of user properties?";
    const pushPayload = {
      dispatchTargetId,
      dispatcher: "firebase-cloud-messaging",
      dispatchInformation: {
        notification: {
          title: pushMessage
        },
        data: {}
      },
      getUafRequest: {
        context: JSON.stringify({
          username,
          transaction: [
            {
              contentType: "text/plain",
              content: Buffer.from(pushMessage).toString("base64"),
            }
          ]
        }),
        op: "Auth"
      }
    };
    await fetch(
      "https://api.national-digital.getnevis.net/nevisfido/token/dispatch/authentication/",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pushPayload),
      }
    );

    // 4️⃣ Return PNG QR code from Nevis response
    return NextResponse.json({
      dispatcherInformation: {
        response: tokenData.dispatcherInformation.response
      },
      sessionId: tokenData.token,
      payload: payload,
    });
  } catch (err) {
    console.error("Internal server error in dispatch-qr-token:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}