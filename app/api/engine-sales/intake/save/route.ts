import { NextRequest, NextResponse } from "next/server";
import { bolDocumentSchema } from "@/lib/bolExtraction";
import {
  createShipment,
  updateShipment,
  logActivity,
  type ShipmentInput,
} from "@/lib/bolShipments";
import { createQuote } from "@/lib/bolQuotes";
import { createInvoiceWithLines } from "@/lib/bolInvoices";
import { createBillOfSale } from "@/lib/billsOfSale";

async function resolveShipmentId(
  shipmentId: number | undefined,
  seed: ShipmentInput
): Promise<number> {
  if (shipmentId) return shipmentId;
  const created = await createShipment(seed);
  return created.id;
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bolDocumentSchema.safeParse(body.document);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid document payload" }, { status: 400 });
  }
  const doc = parsed.data;
  const shipmentId: number | undefined = body.shipment_id ? Number(body.shipment_id) : undefined;

  try {
    switch (doc.document_type) {
      case "bol_shipment": {
        if (!doc.shipment) {
          return NextResponse.json({ error: "No shipment fields extracted." }, { status: 400 });
        }
        const id = await resolveShipmentId(shipmentId, doc.shipment);
        if (shipmentId) await updateShipment(id, doc.shipment);
        await logActivity(id, "bol_uploaded", {
          note: [doc.shipment.bol_number, doc.shipment.pro_number].filter(Boolean).join(" / "),
        });
        return NextResponse.json({ shipment_id: id }, { status: 201 });
      }

      case "quote": {
        if (!doc.quote) {
          return NextResponse.json({ error: "No quote fields extracted." }, { status: 400 });
        }
        const id = await resolveShipmentId(shipmentId, { customer_name: doc.quote.customer_name });
        await createQuote(id, doc.quote);
        return NextResponse.json({ shipment_id: id }, { status: 201 });
      }

      case "invoice": {
        if (!doc.invoice) {
          return NextResponse.json({ error: "No invoice fields extracted." }, { status: 400 });
        }
        const invoice = await createInvoiceWithLines(doc.invoice);
        return NextResponse.json({ invoice_id: invoice.id }, { status: 201 });
      }

      case "bill_of_sale": {
        if (!doc.bill_of_sale) {
          return NextResponse.json({ error: "No bill of sale fields extracted." }, { status: 400 });
        }
        const id = await resolveShipmentId(shipmentId, {
          customer_name: doc.bill_of_sale.customer_name,
        });
        await createBillOfSale({ ...doc.bill_of_sale, shipment_id: id });
        return NextResponse.json({ shipment_id: id }, { status: 201 });
      }

      default:
        return NextResponse.json({ error: "Nothing to save for this document type." }, { status: 400 });
    }
  } catch (err) {
    console.error("intake save failed", err);
    return NextResponse.json({ error: "Could not save this document." }, { status: 500 });
  }
}
