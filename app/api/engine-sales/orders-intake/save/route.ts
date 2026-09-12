import { NextRequest, NextResponse } from "next/server";
import { ebayOrderSchema } from "@/lib/ebayOrderExtraction";
import { createShipment, logActivity } from "@/lib/bolShipments";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ebayOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order payload" }, { status: 400 });
  }
  const order = parsed.data;

  try {
    // eBay order pages don't expose the buyer's email — customer_email stays
    // unset here; add it later from the shipment page before emailing tracking.
    const shipment = await createShipment({
      customer_name: order.buyer_name,
      ship_to_address: order.ship_to_address,
      special_instructions: order.item_title,
    });

    const noteLines = [
      order.order_number ? `eBay order #${order.order_number}` : null,
      order.sales_record_number ? `Sales record #${order.sales_record_number}` : null,
      order.handwritten_notes,
    ].filter(Boolean);

    if (noteLines.length > 0) {
      await logActivity(shipment.id, "note", { note: noteLines.join("\n") });
    }

    return NextResponse.json({ shipment_id: shipment.id }, { status: 201 });
  } catch (err) {
    console.error("orders-intake save failed", err);
    return NextResponse.json({ error: "Could not save this order." }, { status: 500 });
  }
}
