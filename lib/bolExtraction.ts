import { z } from "zod";

// Mirrors the columns in migrations/015_bol_shipments.sql — one optional
// section per table, so the model only fills in what the document actually
// contains.

const nullableString = () => z.string().nullable();
const nullableNumber = () => z.number().nullable();

const shipmentSchema = z.object({
  stock_number: nullableString(),
  customer_name: nullableString(),
  carrier: nullableString(),
  ship_date: nullableString().describe("ISO date, e.g. 2026-03-05"),
  freight_terms: nullableString(),
  ship_from_name: nullableString(),
  ship_from_address: nullableString(),
  ship_from_contact: nullableString(),
  ship_to_name: nullableString(),
  ship_to_address: nullableString(),
  ship_to_contact: nullableString(),
  origin_terminal: nullableString(),
  destination_terminal: nullableString(),
  special_instructions: nullableString(),
  pickup_instructions: nullableString(),
  delivery_instructions: nullableString(),
  bol_number: nullableString(),
  pro_number: nullableString(),
});

const quoteSchema = z.object({
  quote_number: nullableString(),
  quote_date: nullableString(),
  valid_until: nullableString(),
  customer_name: nullableString(),
  carrier: nullableString(),
  service: nullableString(),
  transit_days: z.number().int().nullable(),
  pickup_date: nullableString(),
  origin_terminal: nullableString(),
  destination_terminal: nullableString(),
  qty: z.number().int().nullable(),
  weight_lbs: nullableNumber(),
  nmfc: nullableString(),
  description: nullableString(),
  class: nullableString(),
  estimated_price: nullableNumber(),
});

const invoiceChargeSchema = z.object({
  charge_type: z.string().describe("e.g. FUEL SURCHARGE, RE-CLASS, INSPECTION CHARGE"),
  amount: z.number(),
});

const invoiceLineSchema = z.object({
  ship_date: nullableString(),
  bol_number: nullableString(),
  pro_number: nullableString(),
  class: nullableString(),
  nmfc: nullableString(),
  shipper_name: nullableString(),
  receiver_name: nullableString(),
  pieces: z.number().int().nullable(),
  description: nullableString(),
  weight_lbs: nullableNumber(),
  dims: nullableString(),
  line_total: nullableNumber(),
  charges: z.array(invoiceChargeSchema),
});

const invoiceSchema = z.object({
  invoice_number: nullableString(),
  invoice_date: nullableString(),
  due_date: nullableString(),
  account_number: nullableString(),
  amount_due: nullableNumber(),
  lines: z.array(invoiceLineSchema),
});

const billOfSaleSchema = z.object({
  sale_date: nullableString(),
  customer_name: nullableString(),
  customer_address: nullableString(),
  customer_contact: nullableString(),
  item_description: nullableString(),
  vin: nullableString(),
  serial_number: nullableString(),
  mileage: nullableString(),
  item_price: nullableNumber(),
  shipping: nullableNumber(),
  sales_tax: nullableNumber(),
  total: nullableNumber(),
});

export const bolDocumentSchema = z.object({
  document_type: z.enum(["bol_shipment", "quote", "invoice", "bill_of_sale", "unknown"]),
  notes: z
    .string()
    .nullable()
    .describe("Anything illegible, ambiguous, or that didn't fit the fields above"),
  shipment: shipmentSchema.nullable(),
  quote: quoteSchema.nullable(),
  invoice: invoiceSchema.nullable(),
  bill_of_sale: billOfSaleSchema.nullable(),
});

export type BolDocument = z.infer<typeof bolDocumentSchema>;
