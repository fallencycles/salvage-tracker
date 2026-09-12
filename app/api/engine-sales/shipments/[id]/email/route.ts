import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/bolShipments";

// STUBBED: no email provider is wired up yet. Per this project's rule against
// hardcoding a provider SDK, real delivery must start by invoking the Vercel
// `marketplace` skill to discover/provision an email integration — see
// lib/bolEmail.ts's header comment and the Engine Sales plan. Until then this
// just records that the email *would* have been sent, so the rest of the UI
// (compose screen, activity timeline) can be built and tested independently.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid shipment id" }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { to, subject, body: emailBody } = body;
  if (!to || !subject) {
    return NextResponse.json({ error: "Missing recipient or subject." }, { status: 400 });
  }

  try {
    await logActivity(id, "email_sent", {
      actor: body.actor,
      metadata: { to, subject, body: emailBody, sent: false, reason: "stubbed — no provider wired up yet" },
    });
    return NextResponse.json({ ok: true, stubbed: true });
  } catch (err) {
    console.error("email send (stub) failed", err);
    return NextResponse.json({ error: "Could not log this email." }, { status: 500 });
  }
}
