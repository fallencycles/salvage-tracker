// Import exploded-view component diagrams into Supabase Storage + Postgres.
//
//   IMAGES_DIR=/path/to/pngs \
//   COMPONENT_IMAGES_JSON=/path/to/all_component_images.json \
//   node scripts/import_component_images.mjs
//
// Defaults: COMPONENT_IMAGES_JSON=data/all_component_images.json, IMAGES_DIR=data/component_images.
//
// Needs in .env.local (or the environment):
//   NEXT_PUBLIC_SUPABASE_URL   - https://<ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  - service_role key (bucket create + upload); NOT the publishable/anon key
//   DATABASE_URL               - same Postgres the app uses
//
// Re-runnable: skips files already in the bucket, upserts rows on (catalog, component).
// Additive only - never drops or truncates existing tables.

import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const name of [".env.local", ".env"]) {
  const file = path.join(ROOT, name);
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = process.env.CATALOG_DIAGRAM_BUCKET || "catalog-diagrams";
const JSON_PATH = process.env.COMPONENT_IMAGES_JSON
  ? path.resolve(process.env.COMPONENT_IMAGES_JSON)
  : path.join(ROOT, "data", "all_component_images.json");
const IMAGES_DIR = process.env.IMAGES_DIR
  ? path.resolve(process.env.IMAGES_DIR)
  : path.join(ROOT, "data", "component_images");
const CONCURRENCY = Number(process.env.UPLOAD_CONCURRENCY || 8);

function bail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!SUPABASE_URL) bail("NEXT_PUBLIC_SUPABASE_URL is not set.");
if (!SERVICE_KEY) bail("SUPABASE_SERVICE_ROLE_KEY is not set (service_role key, not the publishable key).");
if (!process.env.DATABASE_URL) bail("DATABASE_URL is not set.");
if (!existsSync(JSON_PATH)) bail(`Not found: ${JSON_PATH}`);
if (!existsSync(IMAGES_DIR)) bail(`Image folder not found: ${IMAGES_DIR}`);

const entries = JSON.parse(readFileSync(JSON_PATH, "utf8"));
if (!Array.isArray(entries) || entries.length === 0) bail("JSON is empty or not an array.");
console.log(`${entries.length} component-image entries; images dir ${IMAGES_DIR}`);

const storageHeaders = { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY };
const publicUrl = (file) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(file)}`;

async function ensureBucket() {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...storageHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (res.ok) {
    console.log(`created bucket "${BUCKET}" (public)`);
    return;
  }
  const body = await res.text();
  if (res.status === 409 || /already exists/i.test(body)) {
    console.log(`bucket "${BUCKET}" already exists`);
    return;
  }
  bail(`could not create bucket: ${res.status} ${body}`);
}

async function objectExists(file) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/info/public/${BUCKET}/${encodeURIComponent(file)}`, {
    headers: storageHeaders,
  });
  return res.ok;
}

async function uploadOne(file) {
  const abs = path.join(IMAGES_DIR, file);
  if (!existsSync(abs)) return { file, status: "missing_file" };
  if (await objectExists(file)) return { file, status: "exists" };
  const bytes = readFileSync(abs);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(file)}`, {
    method: "POST",
    headers: { ...storageHeaders, "Content-Type": "image/png", "x-upsert": "true" },
    body: bytes,
  });
  if (!res.ok) return { file, status: `error:${res.status}:${(await res.text()).slice(0, 120)}` };
  return { file, status: "uploaded", bytes: bytes.length };
}

async function runPool(items, worker, concurrency) {
  const results = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await worker(items[idx], idx);
        if (idx % 200 === 0) process.stdout.write(`\r  ${idx}/${items.length}`);
      }
    })
  );
  process.stdout.write(`\r  ${items.length}/${items.length}\n`);
  return results;
}

async function main() {
  await ensureBucket();

  console.log("uploading PNGs...");
  const uploads = await runPool(entries.map((e) => e.image_file), uploadOne, CONCURRENCY);
  const tally = uploads.reduce((m, r) => ((m[r.status.split(":")[0]] = (m[r.status.split(":")[0]] || 0) + 1), m), {});
  console.log("upload tally:", tally);
  const failures = uploads.filter((r) => r.status.startsWith("error") || r.status === "missing_file");
  if (failures.length) {
    console.log(`\n${failures.length} problem file(s):`);
    for (const f of failures.slice(0, 40)) console.log(`  ${f.status}  ${f.file}`);
    if (failures.length > 40) console.log(`  ...and ${failures.length - 40} more`);
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*(&|$)/, (_m, p1, p2) => (p2 === "&" ? p1 : "")),
    ssl: /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(process.env.DATABASE_URL) ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();

  console.log("upserting rows...");
  const BATCH = 500;
  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);
    const values = [];
    const tuples = slice.map((e, k) => {
      const b = k * 4;
      values.push(e.catalog, e.component, e.page ?? null, publicUrl(e.image_file));
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4})`;
    });
    await client.query(
      `insert into catalog_component_image (catalog, component, page, image_url)
       values ${tuples.join(", ")}
       on conflict (catalog, component)
       do update set page = excluded.page, image_url = excluded.image_url`,
      values
    );
    process.stdout.write(`\r  ${Math.min(i + BATCH, entries.length)}/${entries.length}`);
  }
  process.stdout.write("\n");

  // ---- sanity checks ----
  const { rows: cnt } = await client.query("select count(*)::int as n from catalog_component_image");
  console.log(`\ncatalog_component_image rows: ${cnt[0].n} (expected ${entries.length})`);

  const { rows: missing } = await client.query(
    `select distinct regexp_replace(cp.source_catalog, '_parts\\.json$', '') as catalog, cp.component
       from catalog_part cp
       left join catalog_component_image ci
         on ci.catalog = regexp_replace(cp.source_catalog, '_parts\\.json$', '')
        and ci.component = cp.component
      where ci.id is null
      order by 1, 2`
  );
  console.log(`\nparts-table (catalog, component) pairs with NO diagram: ${missing.length}`);
  for (const r of missing.slice(0, 60)) console.log(`  ${r.catalog}  |  ${r.component}`);
  if (missing.length > 60) console.log(`  ...and ${missing.length - 60} more`);

  const { rows: orphan } = await client.query(
    `select ci.catalog, ci.component
       from catalog_component_image ci
       left join (select distinct regexp_replace(source_catalog, '_parts\\.json$', '') as catalog, component from catalog_part) p
         on p.catalog = ci.catalog and p.component = ci.component
      where p.catalog is null
      order by 1, 2`
  );
  console.log(`\ndiagrams with NO matching (catalog, component) in parts table: ${orphan.length}`);
  for (const r of orphan.slice(0, 60)) console.log(`  ${r.catalog}  |  ${r.component}`);
  if (orphan.length > 60) console.log(`  ...and ${orphan.length - 60} more`);

  await client.end();
  console.log("\ndone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
