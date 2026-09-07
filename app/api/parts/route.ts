import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const stockNumber = req.nextUrl.searchParams.get("stock_number");
  const status = req.nextUrl.searchParams.get("status");
  const db = getDb();

  const conditions: string[] = [];
  const values: string[] = [];
  if (stockNumber) {
    values.push(stockNumber);
    conditions.push(`stock_number = $${values.length}`);
  }
  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";

  const result = await db.query(`select * from parts ${where} order by created_at desc`, values);
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const { stock_number, part_name, category, condition, asking_price } = await req.json();
  if (!stock_number || !part_name) {
    return NextResponse.json({ error: "stock_number and part_name are required" }, { status: 400 });
  }

  const db = getDb();
  const result = await db.query(
    `insert into parts (stock_number, part_name, category, condition, asking_price)
     values ($1, $2, $3, $4, $5) returning *`,
    [stock_number, part_name, category, condition, asking_price]
  );
  return NextResponse.json(result.rows[0], { status: 201 });
}
