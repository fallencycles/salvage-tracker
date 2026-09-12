import { NextRequest, NextResponse } from "next/server";
import { getShipment, updateShipment, isValidBolShipmentStatus } from "@/lib/bolShipments";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid shipment id" }, { status: 400 });
  }

  const shipment = await getShipment(id);
  if (!shipment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(shipment);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  if (body.status && !isValidBolShipmentStatus(body.status)) {
    return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 });
  }

  try {
    const updated = await updateShipment(id, body, { actor: body.actor });
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("updateShipment failed", err);
    return NextResponse.json({ error: "Could not update the shipment." }, { status: 500 });
  }
}
