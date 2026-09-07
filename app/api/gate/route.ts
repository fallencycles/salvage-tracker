import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

const COOKIE = "fc_gate";

export async function POST(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    // gate disabled — nothing to do
    return NextResponse.json({ ok: true });
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  if (typeof body.password !== "string" || body.password !== password) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = createHash("sha256").update(`fc-gate:${password}`).digest("hex");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
