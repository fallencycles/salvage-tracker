import { NextRequest, NextResponse } from "next/server";
import { catalogPartDetail } from "@/lib/catalog";

// pg needs the Node.js runtime (not edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const no = req.nextUrl.searchParams.get("no");
  if (!no) return NextResponse.json({ error: "missing ?no=" }, { status: 400 });

  try {
    const part = await catalogPartDetail(no);
    if (!part) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(part);
  } catch (err) {
    console.error("catalog part detail failed", err);
    return NextResponse.json({ error: "catalog part detail failed" }, { status: 500 });
  }
}
