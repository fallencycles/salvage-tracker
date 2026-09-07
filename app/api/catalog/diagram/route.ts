import { NextRequest, NextResponse } from "next/server";
import { diagramParts } from "@/lib/catalog";

// pg needs the Node.js runtime (not edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Parts list for one exploded-view diagram, keyed by (catalog, component) —
// lets the part modal show what every other callout number on the image is.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const catalog = sp.get("catalog");
  const component = sp.get("component");

  if (!catalog || !component) {
    return NextResponse.json({ error: "catalog and component are required" }, { status: 400 });
  }

  try {
    const parts = await diagramParts(catalog, component);
    return NextResponse.json({ parts });
  } catch (err) {
    console.error("diagram parts lookup failed", err);
    return NextResponse.json({ error: "diagram parts lookup failed" }, { status: 500 });
  }
}
