import { NextRequest, NextResponse } from "next/server";
import { createBillOfSale } from "@/lib/billsOfSale";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.customer_name && !body?.item_description) {
    return NextResponse.json(
      { error: "Add at least a customer name or item description." },
      { status: 400 }
    );
  }

  try {
    const record = await createBillOfSale(body);
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    console.error("createBillOfSale failed", err);
    return NextResponse.json({ error: "Could not save the bill of sale." }, { status: 500 });
  }
}
