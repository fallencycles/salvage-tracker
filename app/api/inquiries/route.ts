import { NextRequest, NextResponse } from "next/server";
import { createInquiry, listInquiries } from "@/lib/inquiries";

export async function GET() {
  const rows = await listInquiries(100);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parts = Array.isArray(body?.parts) ? body.parts : [];
  const hasContact = ["customer_name", "phone", "email", "company"].some(
    (k) => typeof body?.[k] === "string" && body[k].trim() !== ""
  );
  const hasPart = parts.some(
    (p: any) =>
      (typeof p?.oem_part_number === "string" && p.oem_part_number.trim() !== "") ||
      (typeof p?.description === "string" && p.description.trim() !== "")
  );
  if (!hasContact && !hasPart) {
    return NextResponse.json(
      { error: "Add at least a customer name/phone or one part." },
      { status: 400 }
    );
  }

  try {
    const inquiry = await createInquiry({ ...body, parts });
    return NextResponse.json(inquiry, { status: 201 });
  } catch (err) {
    console.error("createInquiry failed", err);
    return NextResponse.json({ error: "Could not save the inquiry." }, { status: 500 });
  }
}
