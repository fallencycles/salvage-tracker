import { z } from "zod";

// For eBay "Order details" page screenshots/PDFs — used by both Engine Sales
// (order-related freight/cancellation cases) and R3 case tracking. Printed
// copies of these often carry handwritten investigation notes (duplicate
// listings, inventory mismatches, cancellations), so those are captured
// separately from the printed eBay fields rather than guessed into them.

const nullableString = () => z.string().nullable();
const nullableNumber = () => z.number().nullable();

export const ebayOrderSchema = z.object({
  order_number: nullableString().describe("eBay order number, e.g. 16-15112-58505"),
  sales_record_number: nullableString(),
  sold_date: nullableString(),
  buyer_paid_date: nullableString(),
  ship_by_date: nullableString(),
  order_status: nullableString().describe(
    "e.g. Shipped, Awaiting shipment, Cancelled — printed status or a handwritten cancellation mark"
  ),

  buyer_name: nullableString(),
  buyer_username: nullableString(),
  buyer_phone: nullableString(),
  buyer_is_repeat: z.boolean().nullable(),
  ship_to_address: nullableString(),
  shipping_service: nullableString(),
  tracking_number: nullableString(),

  item_title: nullableString(),
  sku: nullableString(),
  ebay_item_id: nullableString(),
  quantity: z.number().int().nullable(),
  item_price: nullableNumber(),
  item_total: nullableNumber(),

  subtotal: nullableNumber(),
  shipping_charged: nullableNumber(),
  sales_tax: nullableNumber(),
  order_total: nullableNumber(),
  transaction_fees: nullableNumber(),
  order_earnings: nullableNumber(),

  handwritten_notes: z
    .string()
    .nullable()
    .describe(
      "Any handwritten or highlighted annotations on the printout, transcribed verbatim " +
        "(investigation notes, listing mismatches, cancellation reasons, etc.) — this is often " +
        "the most important part of the document"
    ),
  notes: z
    .string()
    .nullable()
    .describe("Anything illegible, ambiguous, or that didn't fit the fields above"),
});

export type EbayOrder = z.infer<typeof ebayOrderSchema>;
