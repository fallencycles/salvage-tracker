import { getDb } from "@/lib/db";

// The reference parts catalog lives in the same Postgres database as the rest of
// the app (tables catalog_part / catalog_part_fitment / mv_part_fitment_ranges,
// loaded by scripts/import_catalog.mjs). It's a fixed dataset — Harley part
// numbers, the catalog components they appear under, and the model/year ranges
// each part fits — queried read-only here.

export type FitmentRange = {
  model_code: string;
  model_family: string | null;
  year_start: number;
  year_end: number;
};

export type CatalogOccurrence = {
  component: string | null;
  description: string | null;
  page: number | null;
  source_catalog: string | null;
  model_family: string | null;
  international: boolean;
  // Callout / reference number for this part on the component's exploded-view
  // diagram (catalog_part.index_no) — what to look for on the image.
  index_no: string | null;
  diagram_url: string | null;
  diagram_page: number | null;
};

export type CatalogResult = {
  part_no: string;
  part_no_normalized: string;
  description: string | null;
  component: string | null;
  model_count: number;
  occurrences: CatalogOccurrence[];
  fitment: FitmentRange[];
};

export type CatalogSearchResponse = {
  results: CatalogResult[];
  total: number;
  truncated: boolean;
};

// One row of a diagram's parts list — every callout on a single exploded view
// (all catalog_part rows sharing a (catalog, component) pair).
export type DiagramPart = {
  index_no: string | null;
  part_no: string;
  part_no_normalized: string;
  description: string | null;
  page: number | null;
};

const RESULT_LIMIT = 300;

// Turn free text into a safe Postgres tsquery: alphanumeric tokens only, each a
// prefix term AND-ed together (e.g. `brake:* & lever:*`). Anything the user
// types is inert as query syntax.
function toTsQuery(q: string): string {
  const tokens = q.toLowerCase().match(/[a-z0-9]+/g);
  if (!tokens || tokens.length === 0) return "";
  return tokens.map((t) => `${t}:*`).join(" & ");
}

function normalizePartNo(q: string): string {
  return q.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export type CatalogSearchParams = {
  q?: string | null;
  model?: string | null;
  year?: number | null;
};

export async function searchCatalog({
  q,
  model,
  year,
}: CatalogSearchParams): Promise<CatalogSearchResponse> {
  const db = getDb();
  const text = (q ?? "").trim();
  const qNorm = normalizePartNo(text);
  const tsQuery = toTsQuery(text);
  const modelArg = model || null;
  const yearArg = year ?? null;

  // score: lower is better. Exact/prefix part-number hits beat full-text
  // relevance, which is ordered by ts_rank_cd (higher = better, so negated).
  const scored = new Map<string, number>();

  if (qNorm.length >= 2) {
    const { rows } = await db.query<{ n: string }>(
      `select n from (
         select distinct part_no_normalized as n
           from catalog_part
          where part_no_normalized like $1
       ) s
       order by length(n), n
       limit 400`,
      [`${qNorm}%`]
    );
    for (const { n } of rows) {
      scored.set(n, n === qNorm ? -1e12 : -1e9 + n.length);
    }
  }

  if (tsQuery) {
    const { rows } = await db.query<{ n: string; rank: number }>(
      `with q as (select to_tsquery('english', $1) as query)
       select cp.part_no_normalized as n, max(ts_rank_cd(cp.search, q.query)) as rank
         from catalog_part cp, q
        where cp.search @@ q.query
        group by cp.part_no_normalized
        order by rank desc
        limit 2000`,
      [tsQuery]
    );
    for (const { n, rank } of rows) {
      if (!scored.has(n)) scored.set(n, -rank);
    }
  }

  let candidates: string[];

  if (!text) {
    // No query text — browse by model and/or year straight from the ranges.
    if (!modelArg && !yearArg) {
      return { results: [], total: 0, truncated: false };
    }
    const { rows } = await db.query<{ n: string }>(
      `select n from (
         select distinct part_no_normalized as n
           from mv_part_fitment_ranges
          where ($1::text is null or model_code = $1)
            and ($2::int is null or (year_start <= $2 and year_end >= $2))
       ) s
       order by length(n), n
       limit 4000`,
      [modelArg, yearArg]
    );
    candidates = rows.map((r) => r.n);
  } else {
    candidates = [...scored.keys()];
  }

  if (candidates.length === 0) return { results: [], total: 0, truncated: false };

  // Apply model / year filters for the text-search path (the browse path above
  // already filtered).
  if (text && (modelArg || yearArg)) {
    const { rows } = await db.query<{ n: string }>(
      `select distinct part_no_normalized as n
         from mv_part_fitment_ranges
        where part_no_normalized = any($1::text[])
          and ($2::text is null or model_code = $2)
          and ($3::int is null or (year_start <= $3 and year_end >= $3))`,
      [candidates, modelArg, yearArg]
    );
    const keep = new Set(rows.map((r) => r.n));
    candidates = candidates.filter((n) => keep.has(n));
  }

  const filteredTotal = candidates.length;
  if (filteredTotal === 0) return { results: [], total: 0, truncated: false };

  if (text) {
    candidates.sort((a, b) => {
      const d = (scored.get(a) ?? 0) - (scored.get(b) ?? 0);
      if (d !== 0) return d;
      return a.length - b.length || a.localeCompare(b);
    });
  }

  const truncated = filteredTotal > RESULT_LIMIT;
  const page = candidates.slice(0, RESULT_LIMIT);

  const [occ, fit] = await Promise.all([
    db.query<{
      n: string;
      part_no: string;
      component: string | null;
      description: string | null;
      page: number | null;
      source_catalog: string | null;
      model_family: string | null;
      international: boolean;
      index_no: string | null;
      diagram_url: string | null;
      diagram_page: number | null;
    }>(
      `select cp.part_no_normalized as n, cp.part_no, cp.component, cp.description, cp.page,
              cp.source_catalog, cp.model_family, cp.international, cp.index_no,
              ci.image_url as diagram_url, ci.page as diagram_page
         from catalog_part cp
         left join catalog_component_image ci
           on ci.catalog = regexp_replace(cp.source_catalog, '_parts\\.json$', '')
          and ci.component = cp.component
        where cp.part_no_normalized = any($1::text[])`,
      [page]
    ),
    db.query<{
      n: string;
      model_code: string;
      model_family: string | null;
      year_start: number;
      year_end: number;
    }>(
      `select part_no_normalized as n, model_code, model_family, year_start, year_end
         from mv_part_fitment_ranges
        where part_no_normalized = any($1::text[])
        order by model_code, year_start`,
      [page]
    ),
  ]);

  const byNorm = new Map<string, CatalogResult>();
  for (const n of page) {
    byNorm.set(n, {
      part_no: n,
      part_no_normalized: n,
      description: null,
      component: null,
      model_count: 0,
      occurrences: [],
      fitment: [],
    });
  }

  const seenOcc = new Map<string, Set<string>>();
  for (const row of occ.rows) {
    const entry = byNorm.get(row.n);
    if (!entry) continue;
    entry.part_no = row.part_no || entry.part_no;
    const key = `${row.component}|${row.description}|${row.page}|${row.source_catalog}`;
    let seen = seenOcc.get(row.n);
    if (!seen) {
      seen = new Set();
      seenOcc.set(row.n, seen);
    }
    if (!seen.has(key)) {
      seen.add(key);
      entry.occurrences.push({
        component: row.component,
        description: row.description,
        page: row.page,
        source_catalog: row.source_catalog,
        model_family: row.model_family,
        international: row.international === true,
        index_no: row.index_no ?? null,
        diagram_url: row.diagram_url ?? null,
        diagram_page: row.diagram_page ?? null,
      });
    }
    if (!entry.description && row.description) entry.description = row.description;
    if (!entry.component && row.component) entry.component = row.component;
  }

  const models = new Map<string, Set<string>>();
  for (const row of fit.rows) {
    const entry = byNorm.get(row.n);
    if (!entry) continue;
    entry.fitment.push({
      model_code: row.model_code,
      model_family: row.model_family,
      year_start: row.year_start,
      year_end: row.year_end,
    });
    let set = models.get(row.n);
    if (!set) {
      set = new Set();
      models.set(row.n, set);
    }
    set.add(row.model_code);
  }
  for (const [n, set] of models) {
    const entry = byNorm.get(n);
    if (entry) entry.model_count = set.size;
  }

  for (const entry of byNorm.values()) {
    entry.occurrences.sort(
      (a, b) =>
        (a.component ?? "").localeCompare(b.component ?? "") ||
        (a.source_catalog ?? "").localeCompare(b.source_catalog ?? "")
    );
  }

  return {
    results: page.map((n) => byNorm.get(n)!),
    total: filteredTotal,
    truncated,
  };
}

// Every part on one exploded-view diagram, so a viewer can read off any callout
// number (not just the one they searched). A diagram is one image per
// (catalog, component); the catalog slug is source_catalog minus "_parts.json".
export async function diagramParts(catalog: string, component: string): Promise<DiagramPart[]> {
  const db = getDb();
  const { rows } = await db.query<{
    index_no: string | null;
    part_no: string;
    part_no_normalized: string;
    description: string | null;
    page: number | null;
  }>(
    `select index_no, part_no, part_no_normalized, description, page
       from catalog_part
      where regexp_replace(source_catalog, '_parts\\.json$', '') = $1
        and component = $2`,
    [catalog, component]
  );

  // Dedup by (callout, part) — a part can be listed on several sub-pages of the
  // same component; two genuinely different parts can share a callout number
  // (e.g. domestic / California variants), and both are kept.
  const seen = new Set<string>();
  const parts: DiagramPart[] = [];
  for (const r of rows) {
    const idx = (r.index_no ?? "").trim();
    const key = `${idx}|${r.part_no_normalized}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push({
      index_no: idx || null,
      part_no: r.part_no,
      part_no_normalized: r.part_no_normalized,
      description: r.description,
      page: r.page,
    });
  }

  // Numeric callouts ascending, then any non-numeric callouts, then unnumbered.
  parts.sort((a, b) => {
    const na = a.index_no ? parseInt(a.index_no, 10) : NaN;
    const nb = b.index_no ? parseInt(b.index_no, 10) : NaN;
    const aNum = !Number.isNaN(na);
    const bNum = !Number.isNaN(nb);
    if (aNum && bNum && na !== nb) return na - nb;
    if (aNum !== bNum) return aNum ? -1 : 1;
    if (!a.index_no !== !b.index_no) return a.index_no ? -1 : 1;
    return (
      (a.index_no ?? "").localeCompare(b.index_no ?? "", undefined, { numeric: true }) ||
      a.part_no.localeCompare(b.part_no)
    );
  });

  return parts;
}

let statsCache: { parts: number; fitmentRanges: number } | null = null;

export async function catalogStats(): Promise<{ parts: number; fitmentRanges: number }> {
  if (!statsCache) {
    const db = getDb();
    const { rows } = await db.query<{ parts: string; ranges: string }>(
      `select
         (select count(distinct part_no_normalized) from catalog_part) as parts,
         (select count(*) from mv_part_fitment_ranges) as ranges`
    );
    statsCache = {
      parts: Number(rows[0]?.parts ?? 0),
      fitmentRanges: Number(rows[0]?.ranges ?? 0),
    };
  }
  return statsCache;
}

let modelCodesCache: string[] | null = null;

export async function catalogModelCodes(): Promise<string[]> {
  if (!modelCodesCache) {
    const db = getDb();
    const { rows } = await db.query<{ model_code: string }>(
      "select distinct model_code from mv_part_fitment_ranges order by model_code"
    );
    modelCodesCache = rows.map((r) => r.model_code);
  }
  return modelCodesCache;
}
