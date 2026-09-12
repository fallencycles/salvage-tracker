import { getDb } from "@/lib/db";
import type { PoolClient } from "pg";
import { logActivity } from "@/lib/bolShipments";

// Reconciliation thresholds — one edit here to tune, not hardcoded in
// multiple places. Either condition tripping flags the shipment: a small
// dollar miss matters more on a cheap shipment than a big one.
export const DISCREPANCY_ABS_THRESHOLD = 25;
export const DISCREPANCY_PCT_THRESHOLD = 15;
export const STALE_INVOICE_DAYS = 21;

const clean = (v: unknown): string | null => {
  if (typeof v !== "string") return v == null ? null : String(v);
  const t = v.trim();
  return t === "" ? null : t;
};
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

export type InvoiceChargeInput = { charge_type: string; amount: number };

export type InvoiceLineInput = {
  ship_date?: string | null;
  bol_number?: string | null;
  pro_number?: string | null;
  class?: string | null;
  nmfc?: string | null;
  shipper_name?: string | null;
  receiver_name?: string | null;
  pieces?: number | null;
  description?: string | null;
  weight_lbs?: number | null;
  dims?: string | null;
  line_total?: number | null;
  charges?: InvoiceChargeInput[];
};

export type InvoiceInput = {
  invoice_number?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  account_number?: string | null;
  amount_due?: number | null;
  lines: InvoiceLineInput[];
};

async function findShipmentIdByBolNumber(client: PoolClient, bolNumber: string | null) {
  if (!bolNumber) return null;
  const result = await client.query<{ id: number }>(
    "select id from bol_shipment where lower(bol_number) = lower($1)",
    [bolNumber]
  );
  return result.rows.length === 1 ? result.rows[0].id : null;
}

export async function createInvoiceWithLines(
  input: InvoiceInput,
  opts: { actor?: string | null } = {}
) {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("begin");

    const invoiceResult = await client.query(
      `insert into bol_invoice (invoice_number, invoice_date, due_date, account_number, amount_due)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [
        clean(input.invoice_number),
        clean(input.invoice_date),
        clean(input.due_date),
        clean(input.account_number),
        num(input.amount_due),
      ]
    );
    const invoice = invoiceResult.rows[0];

    const lines = [];
    for (const line of input.lines ?? []) {
      const shipmentId = await findShipmentIdByBolNumber(client, clean(line.bol_number));

      const lineResult = await client.query(
        `insert into bol_invoice_line
           (invoice_id, shipment_id, ship_date, bol_number, pro_number, class, nmfc,
            shipper_name, receiver_name, pieces, description, weight_lbs, dims, line_total)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         returning *`,
        [
          invoice.id,
          shipmentId,
          clean(line.ship_date),
          clean(line.bol_number),
          clean(line.pro_number),
          clean(line.class),
          clean(line.nmfc),
          clean(line.shipper_name),
          clean(line.receiver_name),
          num(line.pieces),
          clean(line.description),
          num(line.weight_lbs),
          clean(line.dims),
          num(line.line_total),
        ]
      );
      const savedLine = lineResult.rows[0];

      const charges = [];
      for (const charge of line.charges ?? []) {
        const chargeResult = await client.query(
          `insert into bol_invoice_charge (invoice_line_id, charge_type, amount)
           values ($1, $2, $3)
           returning *`,
          [savedLine.id, charge.charge_type, num(charge.amount)]
        );
        charges.push(chargeResult.rows[0]);
      }

      if (shipmentId) {
        await logActivity(
          shipmentId,
          "invoice_matched",
          { actor: opts.actor, invoice_line_id: savedLine.id },
          client
        );
      }

      lines.push({ ...savedLine, charges });
    }

    await client.query("commit");
    return { ...invoice, lines };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function getInvoice(id: number) {
  const db = getDb();
  const invoice = await db.query("select * from bol_invoice where id = $1", [id]);
  if (invoice.rows.length === 0) return null;
  const lines = await db.query(
    "select * from bol_invoice_line where invoice_id = $1 order by id",
    [id]
  );
  const charges = await db.query(
    "select * from bol_invoice_charge where invoice_line_id = any($1::bigint[])",
    [lines.rows.map((l) => l.id)]
  );
  return {
    ...invoice.rows[0],
    lines: lines.rows.map((l) => ({
      ...l,
      charges: charges.rows.filter((c) => c.invoice_line_id === l.id),
    })),
  };
}

export async function listInvoices(opts: { paymentStatus?: string; limit?: number } = {}) {
  const db = getDb();
  const limit = opts.limit ?? 200;
  if (opts.paymentStatus) {
    const result = await db.query(
      "select * from bol_invoice where payment_status = $1 order by invoice_date desc nulls last, id desc limit $2",
      [opts.paymentStatus, limit]
    );
    return result.rows;
  }
  const result = await db.query(
    "select * from bol_invoice order by invoice_date desc nulls last, id desc limit $1",
    [limit]
  );
  return result.rows;
}

export async function setInvoicePaymentStatus(id: number, status: "unpaid" | "paid" | "disputed") {
  const db = getDb();
  const result = await db.query(
    `update bol_invoice
        set payment_status = $2, paid_at = case when $2 = 'paid' then now() else null end
      where id = $1
      returning *`,
    [id, status]
  );
  return result.rows[0] ?? null;
}

export type ReconciliationRow = {
  shipment_id: number;
  customer_name: string | null;
  carrier: string | null;
  status: string | null;
  ship_date: string | null;
  quoted: number | null;
  actual: number | null;
  variance: number | null;
  variancePct: number | null;
  flagged: boolean;
  reason: "variance" | "invoiced_no_quote" | "stale_no_invoice" | null;
};

export async function getReconciliationSummary(): Promise<ReconciliationRow[]> {
  const db = getDb();
  const result = await db.query(`
    select
      s.id as shipment_id,
      s.customer_name,
      s.carrier,
      s.status,
      s.ship_date,
      q.estimated_price as quoted,
      inv.lines_total,
      inv.charges_total,
      inv.line_count
    from bol_shipment s
    left join lateral (
      select estimated_price
      from bol_quote
      where shipment_id = s.id
      order by quote_date desc nulls last, id desc
      limit 1
    ) q on true
    left join lateral (
      select
        sum(l.line_total) as lines_total,
        sum(coalesce(ch.amount, 0)) as charges_total,
        count(distinct l.id) as line_count
      from bol_invoice_line l
      left join bol_invoice_charge ch on ch.invoice_line_id = l.id
      where l.shipment_id = s.id
    ) inv on true
    where q.estimated_price is not null or inv.line_count > 0
  `);

  const staleCutoff = new Date();
  staleCutoff.setDate(staleCutoff.getDate() - STALE_INVOICE_DAYS);

  return result.rows.map((row) => {
    const quoted = row.quoted != null ? Number(row.quoted) : null;
    const lineCount = Number(row.line_count ?? 0);
    const actual =
      lineCount > 0 ? Number(row.lines_total ?? 0) + Number(row.charges_total ?? 0) : null;

    let flagged = false;
    let reason: ReconciliationRow["reason"] = null;
    let variance: number | null = null;
    let variancePct: number | null = null;

    if (quoted != null && actual != null) {
      variance = actual - quoted;
      variancePct = quoted !== 0 ? (variance / quoted) * 100 : null;
      if (
        Math.abs(variance) > DISCREPANCY_ABS_THRESHOLD ||
        (variancePct != null && Math.abs(variancePct) > DISCREPANCY_PCT_THRESHOLD)
      ) {
        flagged = true;
        reason = "variance";
      }
    } else if (quoted == null && actual != null) {
      flagged = true;
      reason = "invoiced_no_quote";
    } else if (quoted != null && actual == null) {
      const shipDate = row.ship_date ? new Date(row.ship_date) : null;
      if (shipDate && shipDate < staleCutoff) {
        flagged = true;
        reason = "stale_no_invoice";
      }
    }

    return {
      shipment_id: Number(row.shipment_id),
      customer_name: row.customer_name,
      carrier: row.carrier,
      status: row.status,
      ship_date: row.ship_date,
      quoted,
      actual,
      variance,
      variancePct,
      flagged,
      reason,
    };
  });
}
