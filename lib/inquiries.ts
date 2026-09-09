import { getDb } from "@/lib/db";
import type { PoolClient } from "pg";

// Customer inquiry log: one record per phone call (contact + the motorcycle),
// with one or more requested parts hanging off it. Written from the /inquiries
// form, read back for the recent list, editable at /inquiries/[id], and dumped
// to the CSV export.

export type InquiryPartInput = {
  id?: number | null; // set when editing an existing part line
  oem_part_number?: string | null;
  description?: string | null;
  qty?: number | null;
  notes?: string | null;
  source?: string | null; // 'manual' | 'catalog' | 'ebay' | ...
  catalog_part_no?: string | null; // catalog_part.part_no_normalized when linked
  source_ref?: string | null; // external id for future integrations
};

export type InquiryInput = {
  customer_name?: string | null;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  moto_year?: string | null;
  moto_make?: string | null;
  moto_model?: string | null;
  taken_by?: string | null;
  notes?: string | null;
  status?: string | null; // 'open' | 'closed' — only honored on update
  parts: InquiryPartInput[];
};

type NormalizedPart = {
  id: number | null;
  oem_part_number: string | null;
  description: string | null;
  qty: number | null;
  notes: string | null;
  source: string;
  catalog_part_no: string | null;
  source_ref: string | null;
};

// Shape raw form parts into DB-ready values and drop blank lines (no part
// number and no description).
function normalizeParts(raw: InquiryPartInput[] | undefined): NormalizedPart[] {
  return (raw ?? [])
    .map((p) => ({
      id: p.id == null || Number.isNaN(Number(p.id)) ? null : Math.trunc(Number(p.id)),
      oem_part_number: clean(p.oem_part_number),
      description: clean(p.description),
      qty: p.qty == null || Number.isNaN(Number(p.qty)) ? null : Math.trunc(Number(p.qty)),
      notes: clean(p.notes),
      source: clean(p.source) ?? "manual",
      catalog_part_no: clean(p.catalog_part_no),
      source_ref: clean(p.source_ref),
    }))
    .filter((p) => p.oem_part_number || p.description);
}

async function insertPart(
  client: PoolClient,
  inquiryId: number,
  position: number,
  p: NormalizedPart
): Promise<InquiryPartRow> {
  const r = await client.query<InquiryPartRow>(
    `insert into customer_inquiry_part
       (inquiry_id, position, oem_part_number, description, qty, notes,
        source, catalog_part_no, source_ref)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id, inquiry_id, position, oem_part_number, description, qty, notes,
               source, catalog_part_no, source_ref, status`,
    [inquiryId, position, p.oem_part_number, p.description, p.qty, p.notes, p.source, p.catalog_part_no, p.source_ref]
  );
  return r.rows[0];
}

export type InquiryPartRow = {
  id: number;
  inquiry_id: number;
  position: number;
  oem_part_number: string | null;
  description: string | null;
  qty: number | null;
  notes: string | null;
  source: string;
  catalog_part_no: string | null;
  source_ref: string | null;
  status: string;
};

export type InquiryRow = {
  id: number;
  created_at: string; // ISO 8601, UTC
  customer_name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  moto_year: string | null;
  moto_make: string | null;
  moto_model: string | null;
  taken_by: string | null;
  notes: string | null;
  status: string;
};

export type InquiryWithParts = InquiryRow & { parts: InquiryPartRow[] };

function clean(v: unknown): string | null {
  if (typeof v !== "string") return v == null ? null : String(v);
  const t = v.trim();
  return t === "" ? null : t;
}

// Insert an inquiry and its parts atomically — either the whole call is logged
// or none of it is. Rows with neither a part number nor a description are
// dropped (blank lines left on the form).
export async function createInquiry(input: InquiryInput): Promise<InquiryWithParts> {
  const parts = normalizeParts(input.parts);

  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("begin");
    const inq = await client.query<InquiryRow>(
      `insert into customer_inquiry
         (customer_name, phone, email, company, moto_year, moto_make, moto_model, taken_by, notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id, created_at, customer_name, phone, email, company,
                 moto_year, moto_make, moto_model, taken_by, notes, status`,
      [
        clean(input.customer_name),
        clean(input.phone),
        clean(input.email),
        clean(input.company),
        clean(input.moto_year),
        clean(input.moto_make),
        clean(input.moto_model),
        clean(input.taken_by),
        clean(input.notes),
      ]
    );
    const inquiry = inq.rows[0];

    const partRows: InquiryPartRow[] = [];
    for (let i = 0; i < parts.length; i++) {
      partRows.push(await insertPart(client, inquiry.id, i, parts[i]));
    }

    await client.query("commit");
    return { ...inquiry, parts: partRows };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function getInquiry(id: number): Promise<InquiryWithParts | null> {
  const db = getDb();
  const inq = await db.query<InquiryRow>(
    `select id, created_at, customer_name, phone, email, company,
            moto_year, moto_make, moto_model, taken_by, notes, status
       from customer_inquiry where id = $1`,
    [id]
  );
  if (inq.rows.length === 0) return null;
  const parts = await db.query<InquiryPartRow>(
    `select id, inquiry_id, position, oem_part_number, description, qty, notes,
            source, catalog_part_no, source_ref, status
       from customer_inquiry_part
      where inquiry_id = $1
      order by position, id`,
    [id]
  );
  return { ...inq.rows[0], parts: parts.rows };
}

// Reconcile the parts of an existing inquiry against the lines coming back from
// the edit form. `incoming` is in display order; a line with an `id` was
// already saved, a line without one is new. `existingIds` is every part id
// currently on this inquiry in the database.
//
// `status` is deliberately never written here: once a part has been marked
// sourced/picked for the pick list, editing an unrelated field on the inquiry
// must not reset that progress.
async function reconcileParts(
  client: PoolClient,
  inquiryId: number,
  incoming: NormalizedPart[],
  existingIds: Set<number>
): Promise<void> {
  const keptIds = new Set<number>();

  for (let i = 0; i < incoming.length; i++) {
    const p = incoming[i];
    if (p.id != null && existingIds.has(p.id)) {
      keptIds.add(p.id);
      await client.query(
        `update customer_inquiry_part set
           position = $1, oem_part_number = $2, description = $3, qty = $4,
           notes = $5, source = $6, catalog_part_no = $7
         where id = $8 and inquiry_id = $9`,
        [i, p.oem_part_number, p.description, p.qty, p.notes, p.source, p.catalog_part_no, p.id, inquiryId]
      );
    } else {
      await insertPart(client, inquiryId, i, p);
    }
  }

  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
  if (toDelete.length > 0) {
    await client.query(
      `delete from customer_inquiry_part where id = any($1::bigint[]) and inquiry_id = $2`,
      [toDelete, inquiryId]
    );
  }
}

// Update an inquiry's contact/motorcycle fields, its status, and its parts, all
// in one transaction. Returns the fresh row, or null if the id doesn't exist.
export async function updateInquiry(id: number, input: InquiryInput): Promise<InquiryWithParts | null> {
  const parts = normalizeParts(input.parts);
  const status = clean(input.status);

  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("begin");
    const upd = await client.query<{ id: number }>(
      `update customer_inquiry set
         customer_name = $2, phone = $3, email = $4, company = $5,
         moto_year = $6, moto_make = $7, moto_model = $8, taken_by = $9, notes = $10,
         status = coalesce($11, status)
       where id = $1
       returning id`,
      [
        id,
        clean(input.customer_name),
        clean(input.phone),
        clean(input.email),
        clean(input.company),
        clean(input.moto_year),
        clean(input.moto_make),
        clean(input.moto_model),
        clean(input.taken_by),
        clean(input.notes),
        status,
      ]
    );
    if (upd.rows.length === 0) {
      await client.query("rollback");
      return null;
    }

    const existing = await client.query<{ id: number }>(
      `select id from customer_inquiry_part where inquiry_id = $1`,
      [id]
    );
    const existingIds = new Set(existing.rows.map((r) => r.id));

    await reconcileParts(client, id, parts, existingIds);

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
  return getInquiry(id);
}

const INQUIRY_COL_NAMES = [
  "id",
  "created_at",
  "customer_name",
  "phone",
  "email",
  "company",
  "moto_year",
  "moto_make",
  "moto_model",
  "taken_by",
  "notes",
  "status",
] as const;
const INQUIRY_COLS = INQUIRY_COL_NAMES.join(", ");
// Same list, qualified with the `i` alias — needed once we JOIN in the part
// table, which also has `id` / `inquiry_id` and would make bare names ambiguous.
const INQUIRY_COLS_I = INQUIRY_COL_NAMES.map((c) => `i.${c}`).join(", ");

// Load each inquiry's parts in one round trip and stitch them on.
async function attachParts(rows: InquiryRow[]): Promise<InquiryWithParts[]> {
  if (rows.length === 0) return [];
  const db = getDb();
  const parts = await db.query<InquiryPartRow>(
    `select id, inquiry_id, position, oem_part_number, description, qty, notes,
            source, catalog_part_no, source_ref, status
       from customer_inquiry_part
      where inquiry_id = any($1::bigint[])
      order by inquiry_id, position, id`,
    [rows.map((r) => r.id)]
  );
  const byInquiry = new Map<number, InquiryPartRow[]>();
  for (const p of parts.rows) {
    const arr = byInquiry.get(p.inquiry_id) ?? [];
    arr.push(p);
    byInquiry.set(p.inquiry_id, arr);
  }
  return rows.map((r) => ({ ...r, parts: byInquiry.get(r.id) ?? [] }));
}

export async function listInquiries(limit = 100): Promise<InquiryWithParts[]> {
  const db = getDb();
  const inq = await db.query<InquiryRow>(
    `select ${INQUIRY_COLS} from customer_inquiry order by created_at desc limit $1`,
    [limit]
  );
  return attachParts(inq.rows);
}

export type InquirySearch = { q?: string | null; year?: string | null; model?: string | null };

// Build the WHERE clause + params for a search. Every filter is optional; an
// all-empty search is handled by the caller (falls back to listInquiries).
//
// The query runs against `customer_inquiry i` LEFT JOINed to
// `customer_inquiry_part p`, so a term can match either the inquiry or any of
// its parts. `startAt` is the first bind-parameter number to use (so the
// caller can append `limit` after). All matching is case-insensitive
// "contains"; values are always bound, never concatenated into the SQL.
function buildInquiryFilter(
  q: string | null,
  year: string | null,
  model: string | null,
  startAt: number
): { clause: string; args: string[] } {
  const parts: string[] = [];
  const args: string[] = [];
  let n = startAt;

  if (q) {
    parts.push(
      `(i.customer_name ilike $${n} or p.oem_part_number ilike $${n} or p.description ilike $${n})`
    );
    args.push(`%${q}%`);
    n++;
  }
  if (year) {
    parts.push(`i.moto_year ilike $${n}`);
    args.push(`%${year}%`);
    n++;
  }
  if (model) {
    parts.push(`i.moto_model ilike $${n}`);
    args.push(`%${model}%`);
    n++;
  }

  return parts.length ? { clause: parts.join(" and "), args } : { clause: "true", args: [] };
}

export async function searchInquiries(params: InquirySearch, limit = 200): Promise<InquiryWithParts[]> {
  const q = clean(params.q);
  const year = clean(params.year);
  const model = clean(params.model);
  if (!q && !year && !model) return listInquiries(limit);

  const db = getDb();
  const { clause, args } = buildInquiryFilter(q, year, model, 1);
  const inq = await db.query<InquiryRow>(
    `select distinct ${INQUIRY_COLS_I}
       from customer_inquiry i
       left join customer_inquiry_part p on p.inquiry_id = i.id
      where ${clause}
      order by i.created_at desc
      limit $${args.length + 1}`,
    [...args, limit]
  );
  return attachParts(inq.rows);
}

// ---- CSV export -----------------------------------------------------------

// Change this if the shop isn't on US Eastern time — it only affects how the
// timestamp column reads in the exported file.
const DISPLAY_TZ = "America/New_York";

export const CSV_COLUMNS = [
  "inquiry_id",
  "received_at",
  "customer_name",
  "phone",
  "email",
  "company",
  "year",
  "make",
  "model",
  "taken_by",
  "inquiry_notes",
  "oem_part_number",
  "part_description",
  "qty",
  "part_notes",
  "part_source",
  "part_status",
  "status",
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];
export type CsvRow = Record<CsvColumn, string>;

export function formatReceivedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // en-CA gives YYYY-MM-DD; keep 24h time, drop seconds.
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${date} ${time}`;
}

export function flattenInquiryToRows(inq: InquiryWithParts): CsvRow[] {
  // The customer + motorcycle columns are identical for every part on the same
  // call — build them once, then spread into each per-part row.
  const shared = {
    inquiry_id: String(inq.id),
    received_at: formatReceivedAt(inq.created_at),
    customer_name: inq.customer_name ?? "",
    phone: inq.phone ?? "",
    email: inq.email ?? "",
    company: inq.company ?? "",
    year: inq.moto_year ?? "",
    make: inq.moto_make ?? "",
    model: inq.moto_model ?? "",
    taken_by: inq.taken_by ?? "",
    inquiry_notes: inq.notes ?? "",
    status: inq.status,
  };

  const partCols = (p: InquiryPartRow | null): Pick<
    CsvRow,
    "oem_part_number" | "part_description" | "qty" | "part_notes" | "part_source" | "part_status"
  > => ({
    oem_part_number: p?.oem_part_number ?? "",
    part_description: p?.description ?? "",
    qty: p?.qty == null ? "" : String(p.qty),
    part_notes: p?.notes ?? "",
    part_source: p?.source ?? "",
    part_status: p?.status ?? "",
  });

  // Contact-only call (no parts): still emit one row so the lead stays in the
  // CSV, with the part columns blank.
  if (inq.parts.length === 0) return [{ ...shared, ...partCols(null) }];

  return inq.parts.map((p) => ({ ...shared, ...partCols(p) }));
}

export function inquiriesToCsv(list: InquiryWithParts[]): string {
  const esc = (v: string) => `"${v.replace(/\r?\n/g, "  ").replace(/"/g, '""')}"`;
  const lines = [CSV_COLUMNS.join(",")];
  for (const inq of list) {
    for (const row of flattenInquiryToRows(inq)) {
      lines.push(CSV_COLUMNS.map((c) => esc(row[c] ?? "")).join(","));
    }
  }
  // Trailing newline so the file ends cleanly; BOM so Excel reads UTF-8.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
