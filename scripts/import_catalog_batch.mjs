// Additive import of a new catalog batch (see docs/ADDING_CATALOGS.md).
//
//   BATCH_DIR=incoming node scripts/import_catalog_batch.mjs
//
// Expects in BATCH_DIR:
//   manifest.json            - { catalogs: [{ slug, ... }], ... }
//   parts.db                 - SQLite: catalog_part + catalog_part_fitment (new catalogs only)
//   component_images.json    - [{ catalog, component, page, image_file }]
//   <slug>_diagrams.zip      - one per catalog (extracted to BATCH_DIR/_images if not already)
//
// Needs in .env.local: DATABASE_URL (pooler), NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.
//
// Additive & re-runnable:
//   - catalog_part / catalog_part_fitment: refuses to run if any of the batch's
//     source_catalog values already exist (prevents duplicates). New ids are the
//     SQLite ids offset past the current MAX(catalog_part.id).
//   - mv_part_fitment_ranges: recomputed (gaps-and-islands) for every part number
//     the batch touches, across the whole fitment table.
//   - catalog_component_image + Storage: upsert on (catalog, component); skips
//     PNGs already in the bucket.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const name of [".env.local", ".env"]) {
  const f = path.join(ROOT, name);
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const BATCH_DIR = path.resolve(process.env.BATCH_DIR || "incoming");
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = process.env.CATALOG_DIAGRAM_BUCKET || "catalog-diagrams";

const bail = (m) => { console.error(m); process.exit(1); };
if (!process.env.DATABASE_URL) bail("DATABASE_URL not set");
if (!SUPABASE_URL) bail("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL not set");
if (!SERVICE_KEY) bail("SUPABASE_SERVICE_ROLE_KEY not set");
for (const f of ["manifest.json", "parts.db", "component_images.json"])
  if (!existsSync(path.join(BATCH_DIR, f))) bail(`missing ${path.join(BATCH_DIR, f)}`);

const manifest = JSON.parse(readFileSync(path.join(BATCH_DIR, "manifest.json"), "utf8"));
const slugs = manifest.catalogs.map((c) => c.slug);
const sourceCatalogs = slugs.map((s) => `${s}_parts.json`);
const imgIndex = JSON.parse(readFileSync(path.join(BATCH_DIR, "component_images.json"), "utf8"));

// images dir: prefer an already-extracted folder, else extract the zips
let IMAGES_DIR = process.env.IMAGES_DIR ? path.resolve(process.env.IMAGES_DIR) : path.join(BATCH_DIR, "_images");
if (!existsSync(IMAGES_DIR) && existsSync(path.join(BATCH_DIR, "_imgcheck"))) IMAGES_DIR = path.join(BATCH_DIR, "_imgcheck");
if (!existsSync(IMAGES_DIR)) {
  execSync(`mkdir -p "${IMAGES_DIR}"`);
  for (const z of manifest.diagram_zips || readdirSync(BATCH_DIR).filter((f) => f.endsWith("_diagrams.zip")))
    execSync(`unzip -o -q "${path.join(BATCH_DIR, z)}" -d "${IMAGES_DIR}"`);
}
const pngs = new Set(readdirSync(IMAGES_DIR));

console.log(`batch: ${manifest.model_line} — ${slugs.join(", ")}`);

// ---- validate before touching the DB ----
{
  const idxPairs = new Set(imgIndex.map((e) => `${e.catalog}||${e.component}`));
  const missPng = imgIndex.filter((e) => !pngs.has(e.image_file));
  if (missPng.length) bail(`${missPng.length} image_file(s) in index not found in ${IMAGES_DIR}, e.g. ${missPng[0].image_file}`);
  if (idxPairs.size !== imgIndex.length) bail("duplicate (catalog, component) in component_images.json");
  const badCat = imgIndex.filter((e) => !slugs.includes(e.catalog));
  if (badCat.length) bail(`component_images.json has catalog(s) not in manifest: ${[...new Set(badCat.map((e) => e.catalog))]}`);
}

const src = new DatabaseSync(path.join(BATCH_DIR, "parts.db"), { readOnly: true });
const parts = src.prepare(
  `select id, model_family, catalog_year_start, catalog_year_end, source_catalog, component,
          index_no, part_no, part_no_normalized, description, models_raw, international, page
     from catalog_part`
).all();
const fitment = src.prepare(
  `select catalog_part_id, part_no_normalized, model_code, model_year, model_family from catalog_part_fitment`
).all();

// parts-table (slug, component) coverage vs the image index
{
  const partPairs = new Set(parts.map((p) => `${p.source_catalog.replace(/_parts\.json$/, "")}||${p.component}`));
  const idxPairs = new Set(imgIndex.map((e) => `${e.catalog}||${e.component}`));
  const noImg = [...partPairs].filter((k) => !idxPairs.has(k));
  const noPart = [...idxPairs].filter((k) => !partPairs.has(k));
  if (noImg.length) { console.error(`\n${noImg.length} parts component(s) with NO diagram:`); noImg.slice(0, 30).forEach((k) => console.error("  " + k)); }
  if (noPart.length) { console.error(`\n${noPart.length} diagram(s) with NO matching parts component:`); noPart.slice(0, 30).forEach((k) => console.error("  " + k)); }
  if (noImg.length || noPart.length) bail("\nfix the (catalog, component) mismatches above and re-run");
  console.log(`coverage OK — ${partPairs.size} (catalog, component) pairs match 1:1`);
}

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*(&|$)/, (_m, p1, p2) => (p2 === "&" ? p1 : "")),
  ssl: /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(process.env.DATABASE_URL) ? undefined : { rejectUnauthorized: false },
});

async function insertRows(table, cols, rows, perBatch) {
  for (let i = 0; i < rows.length; i += perBatch) {
    const slice = rows.slice(i, i + perBatch);
    const vals = [];
    const tuples = slice.map((r) => {
      const ph = cols.map((_, c) => `$${vals.length + c + 1}`);
      vals.push(...cols.map((c) => r[c]));
      return `(${ph.join(",")})`;
    });
    await db.query(`insert into ${table} (${cols.join(",")}) values ${tuples.join(",")}`, vals);
    process.stdout.write(`\r  ${table}: ${Math.min(i + perBatch, rows.length)}/${rows.length}`);
  }
  process.stdout.write("\n");
}

const storageHeaders = { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY };
const publicUrl = (file) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(file)}`;
async function ensureBucket() {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST", headers: { ...storageHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (!r.ok) { const b = await r.text(); if (r.status !== 409 && !/already exists/i.test(b)) bail(`bucket: ${r.status} ${b}`); }
}
async function uploadOne(file) {
  const abs = path.join(IMAGES_DIR, file);
  if (!existsSync(abs)) return "missing_file";
  const head = await fetch(`${SUPABASE_URL}/storage/v1/object/info/public/${BUCKET}/${encodeURIComponent(file)}`, { headers: storageHeaders });
  if (head.ok) return "exists";
  const body = readFileSync(abs);
  // Storage occasionally 5xx's transiently (Cloudflare 520) — retry a few times.
  let last = 0;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(file)}`, {
      method: "POST", headers: { ...storageHeaders, "Content-Type": "image/png", "x-upsert": "true" }, body,
    });
    if (up.ok) return "uploaded";
    last = up.status;
    if (up.status < 500 && up.status !== 429) break;
    await new Promise((r) => setTimeout(r, 400 * attempt));
  }
  return `error:${last}`;
}
async function pool(items, worker, n) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await worker(items[k]); } }));
  return out;
}

async function main() {
  await db.connect();

  const dup = await db.query("select count(*)::int n from catalog_part where source_catalog = any($1::text[])", [sourceCatalogs]);
  if (dup.rows[0].n > 0) bail(`ABORT: ${dup.rows[0].n} catalog_part rows already exist for ${sourceCatalogs.join(", ")} — batch already imported`);

  const before = await db.query(
    "select (select count(*)::int from catalog_part) p, (select count(*)::int from catalog_part_fitment) f, (select count(*)::int from catalog_component_image) i, (select coalesce(max(id),0)::bigint from catalog_part) maxid"
  );
  const maxId = BigInt(before.rows[0].maxid);
  console.log(`before: ${before.rows[0].p} parts, ${before.rows[0].f} fitment, ${before.rows[0].i} images; max id ${maxId}`);

  await db.query("begin");

  await insertRows(
    "catalog_part",
    ["id", "model_family", "catalog_year_start", "catalog_year_end", "source_catalog", "component",
     "index_no", "part_no", "part_no_normalized", "description", "models_raw", "international", "page"],
    parts.map((p) => ({ ...p, id: (maxId + BigInt(p.id)).toString(), international: p.international === 1 })),
    800
  );
  await insertRows(
    "catalog_part_fitment",
    ["catalog_part_id", "part_no_normalized", "model_code", "model_year", "model_family"],
    fitment.map((r) => ({ ...r, catalog_part_id: (maxId + BigInt(r.catalog_part_id)).toString() })),
    1500
  );

  // drop parse-error model_year rows (page numbers / part fragments misread as
  // years) before recomputing ranges
  const junk = await db.query(
    "delete from catalog_part_fitment where model_year is not null and (model_year < 1985 or model_year > 2030) returning 1"
  );
  if (junk.rowCount) console.log(`dropped ${junk.rowCount} fitment row(s) with an implausible model_year`);

  // recompute mv_part_fitment_ranges for every part number the batch touches
  const touched = [...new Set(parts.map((p) => p.part_no_normalized))];
  await db.query("delete from mv_part_fitment_ranges where part_no_normalized = any($1::text[])", [touched]);
  await db.query(
    `insert into mv_part_fitment_ranges (part_no_normalized, model_code, model_family, year_start, year_end, years_confirmed)
     with f as (
       select distinct part_no_normalized, model_code, model_family, model_year
         from catalog_part_fitment
        where part_no_normalized = any($1::text[]) and model_year is not null
     ), g as (
       select *, model_year - row_number() over (
         partition by part_no_normalized, model_code, model_family order by model_year) as grp
       from f
     )
     select part_no_normalized, model_code, model_family, min(model_year), max(model_year), count(*)
       from g group by part_no_normalized, model_code, model_family, grp`,
    [touched]
  );
  const mvNew = await db.query("select count(*)::int n from mv_part_fitment_ranges where part_no_normalized = any($1::text[])", [touched]);
  console.log(`mv_part_fitment_ranges: recomputed ${mvNew.rows[0].n} rows for ${touched.length} part numbers`);

  await db.query("commit");
  await db.query("analyze catalog_part");
  await db.query("analyze catalog_part_fitment");
  await db.query("analyze mv_part_fitment_ranges");

  // ---- component diagrams ----
  await ensureBucket();
  const up = await pool(imgIndex.map((e) => e.image_file), uploadOne, 8);
  const tally = up.reduce((m, s) => ((m[s.split(":")[0]] = (m[s.split(":")[0]] || 0) + 1), m), {});
  console.log("image upload:", tally);
  const bad = up.map((s, k) => [s, imgIndex[k].image_file]).filter(([s]) => s.startsWith("error") || s === "missing_file");
  bad.slice(0, 20).forEach(([s, f]) => console.error(`  ${s}  ${f}`));

  const BATCH = 500;
  for (let i = 0; i < imgIndex.length; i += BATCH) {
    const slice = imgIndex.slice(i, i + BATCH);
    const vals = [];
    const tuples = slice.map((e, k) => {
      const b = k * 4;
      vals.push(e.catalog, e.component, e.page ?? null, publicUrl(e.image_file));
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4})`;
    });
    await db.query(
      `insert into catalog_component_image (catalog, component, page, image_url) values ${tuples.join(",")}
       on conflict (catalog, component) do update set page = excluded.page, image_url = excluded.image_url`,
      vals
    );
  }

  // ---- sanity ----
  const after = await db.query(
    `select
       (select count(*)::int from catalog_part where source_catalog = any($1::text[])) new_parts,
       (select count(*)::int from catalog_part_fitment f join catalog_part p on p.id=f.catalog_part_id where p.source_catalog = any($1::text[])) new_fitment,
       (select count(*)::int from catalog_component_image where catalog = any($2::text[])) new_images,
       (select count(*)::int from catalog_part) tot_parts,
       (select count(*)::int from catalog_component_image) tot_images`,
    [sourceCatalogs, slugs]
  );
  const a = after.rows[0];
  const cov = await db.query(
    `select
       (select count(*) from (
          select distinct regexp_replace(source_catalog,'_parts\\.json$','') c, component from catalog_part where source_catalog = any($1::text[])
          except select catalog, component from catalog_component_image where catalog = any($2::text[])
        ) x) parts_without_diagram,
       (select count(*) from (
          select catalog, component from catalog_component_image where catalog = any($2::text[])
          except select distinct regexp_replace(source_catalog,'_parts\\.json$','') c, component from catalog_part where source_catalog = any($1::text[])
        ) y) diagrams_without_part`,
    [sourceCatalogs, slugs]
  );

  console.log("\n=== result ===");
  console.log(`new catalog_part rows      : ${a.new_parts}  (batch had ${parts.length})`);
  console.log(`new fitment rows           : ${a.new_fitment}  (batch had ${fitment.length})`);
  console.log(`new component_image rows   : ${a.new_images}  (index had ${imgIndex.length})`);
  console.log(`parts components w/o diagram: ${cov.rows[0].parts_without_diagram}`);
  console.log(`diagrams w/o parts component: ${cov.rows[0].diagrams_without_part}`);
  console.log(`totals now                 : ${a.tot_parts} parts, ${a.tot_images} component images`);

  await db.end();
  src.close();
}

main().catch(async (e) => { console.error(e); try { await db.query("rollback"); await db.end(); } catch {} process.exit(1); });
