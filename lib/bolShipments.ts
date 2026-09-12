import { getDb } from "@/lib/db";
import type { PoolClient } from "pg";
import { getReconciliationSummary } from "@/lib/bolInvoices";

// bol_shipment is the anchor "case" record for one engine sale's whole
// freight lifecycle — quotes, the signed BOL, invoice lines, and the bill of
// sale all hang off it via shipment_id. See migrations/015_bol_shipments.sql
// and migrations/016_bol_shipment_activity.sql.

export const BOL_SHIPMENT_STATUSES = [
  "quoted",
  "booked",
  "picked_up",
  "invoiced",
  "reconciled",
] as const;
export type BolShipmentStatus = (typeof BOL_SHIPMENT_STATUSES)[number];

export function isValidBolShipmentStatus(s: string): s is BolShipmentStatus {
  return (BOL_SHIPMENT_STATUSES as readonly string[]).includes(s);
}

export const ACTIVITY_EVENT_TYPES = [
  "quote_uploaded",
  "bol_uploaded",
  "bill_of_sale_created",
  "invoice_matched",
  "email_sent",
  "status_changed",
  "note",
] as const;
export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export type ShipmentInput = {
  stock_number?: string | null;
  order_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  carrier?: string | null;
  ship_date?: string | null;
  freight_terms?: string | null;
  ship_from_name?: string | null;
  ship_from_address?: string | null;
  ship_from_contact?: string | null;
  ship_to_name?: string | null;
  ship_to_address?: string | null;
  ship_to_contact?: string | null;
  origin_terminal?: string | null;
  destination_terminal?: string | null;
  special_instructions?: string | null;
  pickup_instructions?: string | null;
  delivery_instructions?: string | null;
  bol_number?: string | null;
  pro_number?: string | null;
  pro_sticker_photo_path?: string | null;
  status?: string | null;
};

export type ShipmentRow = ShipmentInput & {
  id: number;
  created_at: string;
  updated_at: string;
};

export type ActivityInput = {
  actor?: string | null;
  note?: string | null;
  quote_id?: number | null;
  invoice_line_id?: number | null;
  bill_of_sale_id?: number | null;
  metadata?: Record<string, unknown> | null;
};

const clean = (v: unknown): string | null => {
  if (typeof v !== "string") return v == null ? null : String(v);
  const t = v.trim();
  return t === "" ? null : t;
};

const CREATE_COLUMNS = [
  "stock_number",
  "order_id",
  "customer_name",
  "customer_email",
  "carrier",
  "ship_date",
  "freight_terms",
  "ship_from_name",
  "ship_from_address",
  "ship_from_contact",
  "ship_to_name",
  "ship_to_address",
  "ship_to_contact",
  "origin_terminal",
  "destination_terminal",
  "special_instructions",
  "pickup_instructions",
  "delivery_instructions",
  "bol_number",
  "pro_number",
] as const;

export async function createShipment(
  input: ShipmentInput,
  client?: PoolClient
): Promise<ShipmentRow> {
  const db = client ?? getDb();
  const values = CREATE_COLUMNS.map((c) => clean((input as Record<string, unknown>)[c]));
  const placeholders = CREATE_COLUMNS.map((_, i) => `$${i + 1}`).join(", ");
  const result = await db.query(
    `insert into bol_shipment (${CREATE_COLUMNS.join(", ")})
     values (${placeholders})
     returning *`,
    values
  );
  return result.rows[0];
}

export async function getShipment(id: number) {
  const db = getDb();
  const [shipment, quotes, billsOfSale, invoiceLines, activity] = await Promise.all([
    db.query<ShipmentRow>("select * from bol_shipment where id = $1", [id]),
    db.query(
      "select * from bol_quote where shipment_id = $1 order by quote_date desc nulls last, id desc",
      [id]
    ),
    db.query("select * from bol_bill_of_sale where shipment_id = $1 order by id desc", [id]),
    db.query(
      `select l.*, i.invoice_number, i.invoice_date, i.payment_status,
              coalesce((select sum(c.amount) from bol_invoice_charge c where c.invoice_line_id = l.id), 0) as charges_total
         from bol_invoice_line l
         join bol_invoice i on i.id = l.invoice_id
        where l.shipment_id = $1
        order by l.ship_date desc nulls last, l.id desc`,
      [id]
    ),
    db.query(
      "select * from bol_shipment_activity where shipment_id = $1 order by created_at desc, id desc",
      [id]
    ),
  ]);

  if (shipment.rows.length === 0) return null;

  return {
    ...shipment.rows[0],
    quotes: quotes.rows,
    billsOfSale: billsOfSale.rows,
    invoiceLines: invoiceLines.rows,
    activity: activity.rows,
  };
}

export async function listShipments(opts: { status?: string; limit?: number } = {}) {
  const db = getDb();
  const limit = opts.limit ?? 200;
  if (opts.status) {
    const result = await db.query(
      "select * from bol_shipment where status = $1 order by created_at desc limit $2",
      [opts.status, limit]
    );
    return result.rows;
  }
  const result = await db.query("select * from bol_shipment order by created_at desc limit $1", [
    limit,
  ]);
  return result.rows;
}

export async function searchShipments(q: string, limit = 200) {
  const db = getDb();
  const like = `%${q}%`;
  const result = await db.query(
    `select * from bol_shipment
      where customer_name ilike $1 or stock_number ilike $1 or bol_number ilike $1 or pro_number ilike $1
      order by created_at desc
      limit $2`,
    [like, limit]
  );
  return result.rows;
}

export async function updateShipment(
  id: number,
  patch: ShipmentInput,
  opts: { actor?: string | null } = {}
): Promise<ShipmentRow | null> {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("begin");

    const current = await client.query<ShipmentRow>("select * from bol_shipment where id = $1", [
      id,
    ]);
    if (current.rows.length === 0) {
      await client.query("rollback");
      return null;
    }

    const keys = (Object.keys(patch) as (keyof ShipmentInput)[]).filter(
      (k) => patch[k] !== undefined
    );
    if (keys.length > 0) {
      const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
      const values = keys.map((k) => clean(patch[k]));
      await client.query(
        `update bol_shipment set ${setClauses.join(", ")}, updated_at = now() where id = $1`,
        [id, ...values]
      );
    }

    if (patch.status && patch.status !== current.rows[0].status) {
      await logActivity(
        id,
        "status_changed",
        { actor: opts.actor, metadata: { from: current.rows[0].status, to: patch.status } },
        client
      );
    }

    const updated = await client.query<ShipmentRow>("select * from bol_shipment where id = $1", [
      id,
    ]);
    await client.query("commit");
    return updated.rows[0];
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function logActivity(
  shipmentId: number,
  eventType: ActivityEventType,
  input: ActivityInput = {},
  client?: PoolClient
): Promise<void> {
  const db = client ?? getDb();
  await db.query(
    `insert into bol_shipment_activity
       (shipment_id, event_type, actor, note, quote_id, invoice_line_id, bill_of_sale_id, metadata)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      shipmentId,
      eventType,
      clean(input.actor),
      clean(input.note),
      input.quote_id ?? null,
      input.invoice_line_id ?? null,
      input.bill_of_sale_id ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );
}

export type MatchCandidate = { bol_number?: string | null; customer_name?: string | null };

// Pragmatic, trust-based matching — see migrations/015_bol_shipments.sql and
// the Engine Sales plan for why this stops at "exactly one candidate" rather
// than fuzzy-matching: a wrong auto-attach is worse than an extra click.
export async function matchShipment(
  candidate: MatchCandidate
): Promise<{ auto: ShipmentRow | null; candidates: ShipmentRow[] }> {
  const db = getDb();
  const bolNumber = clean(candidate.bol_number);
  const customerName = clean(candidate.customer_name);

  if (bolNumber) {
    const byBol = await db.query<ShipmentRow>(
      "select * from bol_shipment where lower(bol_number) = lower($1)",
      [bolNumber]
    );
    if (byBol.rows.length === 1) return { auto: byBol.rows[0], candidates: [] };
  }

  if (customerName) {
    const byName = await db.query<ShipmentRow>(
      "select * from bol_shipment where lower(customer_name) = lower($1)",
      [customerName]
    );
    if (byName.rows.length === 1) {
      const only = byName.rows[0];
      const conflicting = bolNumber && only.bol_number && only.bol_number.toLowerCase() !== bolNumber.toLowerCase();
      if (!conflicting) return { auto: only, candidates: [] };
    }
    if (byName.rows.length > 0) {
      return { auto: null, candidates: byName.rows };
    }
  }

  const recent = await listShipments({ limit: 25 });
  return { auto: null, candidates: recent };
}

export async function getShipmentDashboardStats() {
  const db = getDb();
  const [inTransit, openInvoices, awaitingBol, overduePickup, thisWeek, reconciliation] =
    await Promise.all([
      db.query<{ n: number }>(
        "select count(*)::int as n from bol_shipment where status in ('booked', 'picked_up')"
      ),
      db.query<{ n: number; total: string | null }>(
        "select count(*)::int as n, sum(amount_due) as total from bol_invoice where payment_status = 'unpaid'"
      ),
      db.query<{ n: number }>(
        `select count(*)::int as n
           from bol_shipment s
          where s.status = 'quoted'
            and s.bol_number is null
            and exists (select 1 from bol_quote q where q.shipment_id = s.id)`
      ),
      db.query<{ n: number }>(
        "select count(*)::int as n from bol_shipment where status = 'quoted' and ship_date is not null and ship_date < current_date"
      ),
      db.query<{ n: number }>(
        "select count(*)::int as n from bol_shipment where created_at >= now() - interval '7 days'"
      ),
      getReconciliationSummary(),
    ]);

  return {
    inTransitCount: inTransit.rows[0].n,
    openInvoiceCount: openInvoices.rows[0].n,
    openInvoiceTotal: Number(openInvoices.rows[0].total ?? 0),
    awaitingBolCount: awaitingBol.rows[0].n,
    overduePickupCount: overduePickup.rows[0].n,
    shipmentsThisWeek: thisWeek.rows[0].n,
    flaggedReconciliationCount: reconciliation.filter((r) => r.flagged).length,
  };
}
