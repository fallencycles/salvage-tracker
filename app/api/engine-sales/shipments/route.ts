import { NextRequest, NextResponse } from "next/server";
import { createShipment, listShipments, searchShipments } from "@/lib/bolShipments";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status")?.trim();

  const rows = q ? await searchShipments(q) : await listShipments({ status: status || undefined });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const shipment = await createShipment(body);
    return NextResponse.json(shipment, { status: 201 });
  } catch (err) {
    console.error("createShipment failed", err);
    return NextResponse.json({ error: "Could not create the shipment." }, { status: 500 });
  }
}
