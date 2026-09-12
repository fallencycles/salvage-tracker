import { getDb } from "@/lib/db";
import { logActivity } from "@/lib/bolShipments";

export type QuoteInput = {
  quote_number?: string | null;
  quote_date?: string | null;
  valid_until?: string | null;
  customer_name?: string | null;
  carrier?: string | null;
  service?: string | null;
  transit_days?: number | null;
  pickup_date?: string | null;
  origin_terminal?: string | null;
  destination_terminal?: string | null;
  qty?: number | null;
  weight_lbs?: number | null;
  nmfc?: string | null;
  description?: string | null;
  class?: string | null;
  estimated_price?: number | null;
};

const clean = (v: unknown): string | null => {
  if (typeof v !== "string") return v == null ? null : String(v);
  const t = v.trim();
  return t === "" ? null : t;
};
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

const COLUMNS = [
  "quote_number",
  "quote_date",
  "valid_until",
  "customer_name",
  "carrier",
  "service",
  "transit_days",
  "pickup_date",
  "origin_terminal",
  "destination_terminal",
  "qty",
  "weight_lbs",
  "nmfc",
  "description",
  "class",
  "estimated_price",
] as const;

const NUMERIC_COLUMNS = new Set(["transit_days", "qty", "weight_lbs", "estimated_price"]);

export async function createQuote(
  shipmentId: number,
  input: QuoteInput,
  opts: { actor?: string | null } = {}
) {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("begin");

    const values = COLUMNS.map((c) =>
      NUMERIC_COLUMNS.has(c) ? num((input as Record<string, unknown>)[c]) : clean((input as Record<string, unknown>)[c])
    );
    const placeholders = COLUMNS.map((_, i) => `$${i + 2}`).join(", ");
    const result = await client.query(
      `insert into bol_quote (shipment_id, ${COLUMNS.join(", ")})
       values ($1, ${placeholders})
       returning *`,
      [shipmentId, ...values]
    );
    const quote = result.rows[0];

    await logActivity(shipmentId, "quote_uploaded", { actor: opts.actor, quote_id: quote.id }, client);

    await client.query("commit");
    return quote;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function getQuote(id: number) {
  const db = getDb();
  const result = await db.query("select * from bol_quote where id = $1", [id]);
  return result.rows[0] ?? null;
}

export async function listQuotesForShipment(shipmentId: number) {
  const db = getDb();
  const result = await db.query(
    "select * from bol_quote where shipment_id = $1 order by quote_date desc nulls last, id desc",
    [shipmentId]
  );
  return result.rows;
}
