import { NextRequest, NextResponse } from "next/server";
import { getInquiry, updateInquiry } from "@/lib/inquiries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id == null) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const inquiry = await getInquiry(id);
  if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(inquiry);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id == null) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const updated = await updateInquiry(id, { ...body, parts: Array.isArray(body?.parts) ? body.parts : [] });
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("updateInquiry failed", err);
    return NextResponse.json({ error: "Could not save changes." }, { status: 500 });
  }
}
