import { getDb } from "@/lib/db";
import { getReconciliationSummary, type ReconciliationRow } from "@/lib/bolInvoices";

export async function getSpendByMonth() {
  const db = getDb();
  const result = await db.query(
    `select to_char(date_trunc('month', invoice_date), 'YYYY-MM') as month,
            sum(amount_due) as total
       from bol_invoice
      where invoice_date is not null
      group by 1
      order by 1 desc
      limit 12`
  );
  return result.rows.map((r) => ({ month: r.month, total: Number(r.total ?? 0) }));
}

export async function getSpendByCarrier() {
  const db = getDb();
  const result = await db.query(`
    select s.carrier,
           sum(l.line_total) as lines_total,
           sum(coalesce(ch.amount, 0)) as charges_total,
           count(distinct s.id) as shipment_count
      from bol_shipment s
      join bol_invoice_line l on l.shipment_id = s.id
      left join bol_invoice_charge ch on ch.invoice_line_id = l.id
     where s.carrier is not null
     group by s.carrier
     order by sum(l.line_total) desc
  `);
  return result.rows.map((r) => ({
    carrier: r.carrier,
    total: Number(r.lines_total ?? 0) + Number(r.charges_total ?? 0),
    shipmentCount: Number(r.shipment_count),
  }));
}

export async function getFlaggedReconciliations(): Promise<ReconciliationRow[]> {
  const rows = await getReconciliationSummary();
  return rows
    .filter((r) => r.flagged)
    .sort((a, b) => Math.abs(b.variance ?? 0) - Math.abs(a.variance ?? 0));
}

const CSV_COLUMNS = [
  "shipment_id",
  "customer_name",
  "carrier",
  "status",
  "ship_date",
  "quoted",
  "actual",
  "variance",
  "variancePct",
  "flagged",
  "reason",
] as const;

function formatCsvValue(column: (typeof CSV_COLUMNS)[number], value: unknown): string {
  if (value == null) return "";
  if (column === "ship_date") return new Date(value as string).toISOString().slice(0, 10);
  if (column === "variancePct") return Number(value).toFixed(1);
  if (column === "quoted" || column === "actual" || column === "variance") return Number(value).toFixed(2);
  return String(value);
}

export function reconciliationToCsv(rows: ReconciliationRow[]): string {
  const esc = (v: string) => `"${v.replace(/\r?\n/g, "  ").replace(/"/g, '""')}"`;
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((c) => esc(formatCsvValue(c, (row as any)[c]))).join(","));
  }
  // BOM so Excel reads UTF-8, CRLF line endings, trailing newline.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
