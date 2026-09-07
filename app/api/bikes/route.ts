import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const db = getDb();
  const result = status
    ? await db.query("select * from bikes where status = $1 order by created_at desc", [status])
    : await db.query("select * from bikes order by created_at desc");
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { stock_number, vin, make, model, year, purchase_source, purchase_price, purchase_date } = body;

  if (!stock_number) {
    return NextResponse.json({ error: "stock_number is required" }, { status: 400 });
  }

  const db = getDb();
  try {
    const result = await db.query(
      `insert into bikes (stock_number, vin, make, model, year, purchase_source, purchase_price, purchase_date)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [stock_number, vin, make, model, year, purchase_source, purchase_price, purchase_date]
    );

    await db.query(
      `insert into status_history (entity_type, entity_id, from_status, to_status, note)
       values ('bike', $1, null, 'intake', 'Bike created at intake')`,
      [stock_number]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: any) {
    if (err.code === "23505") {
      return NextResponse.json({ error: `Stock number ${stock_number} already exists` }, { status: 409 });
    }
    throw err;
  }
}
