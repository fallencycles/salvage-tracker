// One-time (re-runnable) import of the reference parts catalog from the shipped
// SQLite file into Postgres. Reads data/fallen_cycles_catalog.db, truncates the
// catalog_* / mv_part_fitment_ranges tables, and bulk-loads them.
//
//   node scripts/import_catalog.mjs
//
// Requires DATABASE_URL (loaded from .env.local if present) and that
// migrations/003_parts_catalog.sql has already been applied.

import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Minimal .env.local loader so this runs the same way `next dev` picks it up.
for (const name of [".env.local", ".env"]) {
  const file = path.join(ROOT, name);
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (put it in .env.local).");
  process.exit(1);
}

const SQLITE_FILE = path.join(ROOT, "data", "fallen_cycles_catalog.db");
if (!existsSync(SQLITE_FILE)) {
  console.error(`SQLite catalog not found at ${SQLITE_FILE}`);
  process.exit(1);
}

const src = new DatabaseSync(SQLITE_FILE, { readOnly: true });
const rawUrl = process.env.DATABASE_URL;
const isLocalDb = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(rawUrl);
// Drop sslmode from the string so our explicit ssl object below decides
// verification behavior (recent pg treats sslmode=require as verify-full).
const connectionString = rawUrl.replace(/([?&])sslmode=[^&]*(&|$)/, (_m, p1, p2) =>
  p2 === "&" ? p1 : ""
);
const client = new pg.Client({
  connectionString,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
});

// Insert rows in parameterized batches, staying well under Postgres' 65535
// bound-parameter ceiling.
async function bulkInsert(table, columns, rows, batchRows) {
  const colList = columns.join(", ");
  let done = 0;
  for (let i = 0; i < rows.length; i += batchRows) {
    const slice = rows.slice(i, i + batchRows);
    const params = [];
    const tuples = slice.map((row) => {
      const ph = columns.map((_, c) => `$${params.length + c + 1}`);
      params.push(...columns.map((col) => row[col]));
      return `(${ph.join(", ")})`;
    });
    await client.query(
      `insert into ${table} (${colList}) values ${tuples.join(", ")}`,
      params
    );
    done += slice.length;
    process.stdout.write(`\r  ${table}: ${done}/${rows.length}`);
  }
  process.stdout.write("\n");
}

async function main() {
  await client.connect();
  console.log("connected to Postgres");

  const parts = src
    .prepare(
      `select id, model_family, catalog_year_start, catalog_year_end, source_catalog,
              component, index_no, part_no, part_no_normalized, description,
              models_raw, international, page
         from catalog_part`
    )
    .all()
    .map((r) => ({ ...r, international: r.international === 1 }));

  const fitment = src
    .prepare(
      `select catalog_part_id, part_no_normalized, model_code, model_year, model_family
         from catalog_part_fitment`
    )
    .all();

  const ranges = src
    .prepare(
      `select part_no_normalized, model_code, model_family, year_start, year_end, years_confirmed
         from mv_part_fitment_ranges`
    )
    .all();

  console.log(
    `read from SQLite: ${parts.length} catalog_part, ${fitment.length} fitment, ${ranges.length} ranges`
  );

  await client.query("begin");
  await client.query(
    "truncate catalog_part, catalog_part_fitment, mv_part_fitment_ranges"
  );

  await bulkInsert(
    "catalog_part",
    [
      "id", "model_family", "catalog_year_start", "catalog_year_end", "source_catalog",
      "component", "index_no", "part_no", "part_no_normalized", "description",
      "models_raw", "international", "page",
    ],
    parts,
    1000
  );
  await bulkInsert(
    "catalog_part_fitment",
    ["catalog_part_id", "part_no_normalized", "model_code", "model_year", "model_family"],
    fitment,
    2000
  );
  await bulkInsert(
    "mv_part_fitment_ranges",
    ["part_no_normalized", "model_code", "model_family", "year_start", "year_end", "years_confirmed"],
    ranges,
    2000
  );

  await client.query("commit");
  await client.query("analyze catalog_part");
  await client.query("analyze catalog_part_fitment");
  await client.query("analyze mv_part_fitment_ranges");

  const { rows } = await client.query(
    `select
       (select count(distinct part_no_normalized) from catalog_part) as parts,
       (select count(*) from catalog_part) as part_rows,
       (select count(*) from mv_part_fitment_ranges) as ranges`
  );
  console.log("done:", rows[0]);

  await client.end();
  src.close();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await client.query("rollback");
    await client.end();
  } catch {}
  process.exit(1);
});
