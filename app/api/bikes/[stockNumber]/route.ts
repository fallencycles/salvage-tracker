import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ stockNumber: string }> }
) {
  const { stockNumber } = await params;
  const db = getDb();
  const bike = await db.query("select * from bikes where stock_number = $1", [stockNumber]);
  if (bike.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parts = await db.query("select * from parts where stock_number = $1 order by created_at", [
    stockNumber,
  ]);
  const history = await db.query(
    "select * from status_history where entity_type = 'bike' and entity_id = $1 order by changed_at",
    [stockNumber]
  );
  return NextResponse.json({ ...bike.rows[0], parts: parts.rows, history: history.rows });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ stockNumber: string }> }
) {
  const { stockNumber } = await params;
  const body = await req.json();
  const fields = ["vin", "make", "model", "year", "purchase_source", "purchase_price", "purchase_date", "notes"];
  const updates = fields.filter((f) => f in body);

  if (updates.length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const setClause = updates.map((f, i) => `${f} = $${i + 2}`).join(", ");
  const values = updates.map((f) => body[f]);

  const db = getDb();
  const result = await db.query(
    `update bikes set ${setClause}, updated_at = now() where stock_number = $1 returning *`,
    [stockNumber, ...values]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(result.rows[0]);
}
