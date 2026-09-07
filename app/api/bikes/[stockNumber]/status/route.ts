import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isValidBikeStatus } from "@/lib/statusFlow";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stockNumber: string }> }
) {
  const { stockNumber } = await params;
  const { status, note } = await req.json();
  if (!isValidBikeStatus(status)) {
    return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
  }

  const user = await getCurrentUser();
  const db = getDb();

  const current = await db.query("select status from bikes where stock_number = $1", [stockNumber]);
  if (current.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const fromStatus = current.rows[0].status;

  const updated = await db.query(
    "update bikes set status = $1, updated_at = now() where stock_number = $2 returning *",
    [status, stockNumber]
  );

  await db.query(
    `insert into status_history (entity_type, entity_id, from_status, to_status, changed_by, note)
     values ('bike', $1, $2, $3, $4, $5)`,
    [stockNumber, fromStatus, status, user?.id ?? null, note ?? null]
  );

  return NextResponse.json(updated.rows[0]);
}
