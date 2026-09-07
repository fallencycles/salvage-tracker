import { NextRequest, NextResponse } from "next/server";
import { searchCatalog } from "@/lib/catalog";

// pg needs the Node.js runtime (not edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q");
  const model = sp.get("model");
  const family = sp.get("family");
  const yearRaw = sp.get("year");
  const year = yearRaw ? parseInt(yearRaw, 10) : null;

  try {
    const data = await searchCatalog({
      q,
      model,
      family,
      year: year && !Number.isNaN(year) ? year : null,
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("catalog search failed", err);
    return NextResponse.json({ error: "catalog search failed" }, { status: 500 });
  }
}
