import { NextRequest, NextResponse } from "next/server";
import { matchShipment } from "@/lib/bolShipments";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await matchShipment({
    bol_number: body.bol_number,
    customer_name: body.customer_name,
  });
  return NextResponse.json(result);
}
