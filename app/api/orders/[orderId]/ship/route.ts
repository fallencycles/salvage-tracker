import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const VALID_SHIPPING_STATUSES = ["awaiting_shipment", "shipped", "delivered", "exception"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const { shipping_status, carrier, tracking_number, note } = await req.json();

  if (!VALID_SHIPPING_STATUSES.includes(shipping_status)) {
    return NextResponse.json({ error: `Invalid shipping_status: ${shipping_status}` }, { status: 400 });
  }

  const user = await getCurrentUser();
  const db = getDb();

  const current = await db.query("select shipping_status from orders where id = $1", [orderId]);
  if (current.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const fromStatus = current.rows[0].shipping_status;

  const timestampField =
    shipping_status === "shipped" ? "shipped_at" : shipping_status === "delivered" ? "delivered_at" : null;

  const result = await db.query(
    `update orders
     set shipping_status = $1,
         carrier = coalesce($2, carrier),
         tracking_number = coalesce($3, tracking_number)
         ${timestampField ? `, ${timestampField} = now()` : ""}
     where id = $4
     returning *`,
    [shipping_status, carrier ?? null, tracking_number ?? null, orderId]
  );

  await db.query(
    `insert into status_history (entity_type, entity_id, from_status, to_status, changed_by, note)
     values ('order', $1, $2, $3, $4, $5)`,
    [orderId, fromStatus, shipping_status, user?.id ?? null, note ?? null]
  );

  return NextResponse.json(result.rows[0]);
}
