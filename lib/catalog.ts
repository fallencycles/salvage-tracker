import { getDb } from "@/lib/db";

// The reference parts catalog lives in the same Postgres database as the rest of
// the app (tables catalog_part / catalog_part_fitment / mv_part_fitment_ranges,
// loaded by scripts/import_catalog.mjs). It's a fixed dataset — Harley part
// numbers, the catalog components they appear under, and the model/year ranges
// each part fits — queried read-only here.

export type FitmentRange = {
  model_code: string;
  model_family: string | null;
  model_name: string | null;
  year_start: number;
  year_end: number;
};

// Canonical model-family buttons in the UI. Anything not in this list is "Other".
export const MODEL_FAMILIES = ["Touring", "Softail", "Dyna", "FXR", "Sportster", "V-Rod", "Trike"] as const;
const OTHER = "Other";

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
  families: string[];
  // In search results these two are summaries only (the row UI needs no more);
  // `occurrences` / `fitment` arrive empty and are filled by catalogPartDetail
  // when a part's modal is opened.
  occ_count: number;
  has_diagram: boolean;
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
  family?: string | null;
  category?: string | null;
};

// Turn a family filter into a SQL fragment + params against a table aliased `t`
// with a `model_family` column. Returns null when there's no family filter.
function familyClause(family: string | null, startIdx: number): { sql: string; args: string[] } | null {
  if (!family) return null;
  if (family === OTHER) {
    const ph = MODEL_FAMILIES.map((_, i) => `$${startIdx + i}`).join(",");
    return { sql: `(t.model_family is null or t.model_family not in (${ph}))`, args: [...MODEL_FAMILIES] };
  }
  return { sql: `t.model_family = $${startIdx}`, args: [family] };
}

export async function searchCatalog({
  q,
  model,
  year,
  family,
  category,
}: CatalogSearchParams): Promise<CatalogSearchResponse> {
  const db = getDb();
  const text = (q ?? "").trim();
  const qNorm = normalizePartNo(text);
  const tsQuery = toTsQuery(text);
  const modelArg = model || null;
  const yearArg = year ?? null;
  const familyArg = family || null;
  // A system filter ("Fenders", "Wiring", …) resolves to the set of component
  // heads that roll up into it.
  const catHeads = await categoryHeads(category);

  const filterByCategory = async (cands: string[]): Promise<string[]> => {
    if (!catHeads || cands.length === 0) return cands;
    const { rows } = await db.query<{ n: string }>(
      `select distinct part_no_normalized as n
         from catalog_part
        where part_no_normalized = any($1::text[])
          and ${COMPONENT_HEAD_SQL} = any($2::text[])`,
      [cands, catHeads]
    );
    const keep = new Set(rows.map((r) => r.n));
    return cands.filter((n) => keep.has(n));
  };

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
    // Descriptions read "<what it is>, <qualifier>" — "FENDER, front" vs
    // "DECAL, fender" vs "SCREW (4), front fender". Pull the head (before the
    // first comma) so a query that names the head can be floated to the top.
    const { rows } = await db.query<{ n: string; rank: number; head: string | null }>(
      `with q as (select to_tsquery('english', $1) as query)
       select cp.part_no_normalized as n,
              max(ts_rank_cd(cp.search, q.query)) as rank,
              min(lower(split_part(coalesce(cp.description, ''), ',', 1))) as head
         from catalog_part cp, q
        where cp.search @@ q.query
        group by cp.part_no_normalized
        order by rank desc
        limit 2000`,
      [tsQuery]
    );
    const qWords = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    const firstWord = qWords[0] ?? "";
    for (const { n, rank, head } of rows) {
      if (scored.has(n)) continue;
      const h = head ?? "";
      // every query word appears in the description head -> it's that part,
      // not something that merely mentions it.
      const headHit = qWords.length > 0 && qWords.every((w) => h.includes(w));
      const headStarts = firstWord !== "" && h.startsWith(firstWord);
      scored.set(n, -rank - (headHit ? 1e6 : 0) - (headStarts ? 5e5 : 0));
    }
  }

  let candidates: string[];

  if (!text) {
    // No query text — browse by family/model/year straight from the ranges.
    if (!modelArg && !yearArg && !familyArg && !catHeads) {
      return { results: [], total: 0, truncated: false };
    }
    if (modelArg || yearArg || familyArg) {
      const fam = familyClause(familyArg, 3);
      const { rows } = await db.query<{ n: string }>(
        `select n from (
           select distinct t.part_no_normalized as n
             from mv_part_fitment_ranges t
            where ($1::text is null or t.model_code = $1)
              and ($2::int is null or (t.year_start <= $2 and t.year_end >= $2))
              ${fam ? `and ${fam.sql}` : ""}
         ) s
         order by length(n), n
         limit 4000`,
        [modelArg, yearArg, ...(fam?.args ?? [])]
      );
      candidates = rows.map((r) => r.n);
      candidates = await filterByCategory(candidates);
    } else {
      // System filter on its own — source straight from catalog_part.
      const { rows } = await db.query<{ n: string }>(
        `select n from (
           select distinct part_no_normalized as n
             from catalog_part
            where ${COMPONENT_HEAD_SQL} = any($1::text[])
         ) s
         order by length(n), n
         limit 4000`,
        [catHeads]
      );
      candidates = rows.map((r) => r.n);
    }
  } else {
    candidates = [...scored.keys()];
  }

  if (candidates.length === 0) return { results: [], total: 0, truncated: false };

  // Apply family / model / year filters for the text-search path (the browse
  // path above already filtered).
  if (text && (modelArg || yearArg || familyArg)) {
    const fam = familyClause(familyArg, 4);
    const { rows } = await db.query<{ n: string }>(
      `select distinct t.part_no_normalized as n
         from mv_part_fitment_ranges t
        where t.part_no_normalized = any($1::text[])
          and ($2::text is null or t.model_code = $2)
          and ($3::int is null or (t.year_start <= $3 and t.year_end >= $3))
          ${fam ? `and ${fam.sql}` : ""}`,
      [candidates, modelArg, yearArg, ...(fam?.args ?? [])]
    );
    const keep = new Set(rows.map((r) => r.n));
    candidates = candidates.filter((n) => keep.has(n));
  }

  // System filter for the text-search path (browse-only paths handled above).
  if (text) {
    candidates = await filterByCategory(candidates);
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

  // The result list only needs summaries per part — a preview description /
  // component, how many occurrences ("+N more"), whether any has a diagram, the
  // model count and families. Full occurrence + fitment arrays (megabytes for a
  // broad browse) are fetched per part by catalogPartDetail when its modal opens.
  const [meta, fits] = await Promise.all([
    db.query<{
      n: string;
      part_no: string | null;
      description: string | null;
      component: string | null;
      occ_count: string;
      has_diagram: boolean;
    }>(
      `select cp.part_no_normalized as n,
              min(cp.part_no) as part_no,
              min(cp.description) as description,
              min(cp.component) as component,
              count(distinct (cp.component, cp.description, cp.page, cp.source_catalog)) as occ_count,
              bool_or(ci.image_url is not null) as has_diagram
         from catalog_part cp
         left join catalog_component_image ci
           on ci.catalog || '_parts.json' = cp.source_catalog
          and ci.component = cp.component
        where cp.part_no_normalized = any($1::text[])
        group by cp.part_no_normalized`,
      [page]
    ),
    db.query<{ n: string; model_count: string; families: string[] | null }>(
      `select r.part_no_normalized as n,
              count(distinct r.model_code) as model_count,
              array_agg(distinct r.model_family) filter (where r.model_family is not null) as families
         from mv_part_fitment_ranges r
        where r.part_no_normalized = any($1::text[])
        group by r.part_no_normalized`,
      [page]
    ),
  ]);

  const metaByN = new Map(meta.rows.map((r) => [r.n, r]));
  const fitByN = new Map(fits.rows.map((r) => [r.n, r]));

  const results: CatalogResult[] = page.map((n) => {
    const m = metaByN.get(n);
    const f = fitByN.get(n);
    return {
      part_no: m?.part_no || n,
      part_no_normalized: n,
      description: m?.description ?? null,
      component: m?.component ?? null,
      model_count: f ? Number(f.model_count) : 0,
      families: [...(f?.families ?? [])].sort((a, b) => a.localeCompare(b)),
      occ_count: m ? Number(m.occ_count) : 0,
      has_diagram: m?.has_diagram === true,
      occurrences: [],
      fitment: [],
    };
  });

  return { results, total: filteredTotal, truncated };
}

// Full occurrence + fitment detail for a single part — what a part's modal
// needs, fetched only when it opens.
export async function catalogPartDetail(partNoRaw: string): Promise<CatalogResult | null> {
  const db = getDb();
  const norm = normalizePartNo(partNoRaw);
  if (norm.length < 2) return null;

  const [occ, fit] = await Promise.all([
    db.query<{
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
      `select distinct cp.part_no, cp.component, cp.description, cp.page,
              cp.source_catalog, cp.model_family, cp.international, cp.index_no,
              ci.image_url as diagram_url, ci.page as diagram_page
         from catalog_part cp
         left join catalog_component_image ci
           on ci.catalog || '_parts.json' = cp.source_catalog
          and ci.component = cp.component
        where cp.part_no_normalized = $1`,
      [norm]
    ),
    db.query<{
      model_code: string;
      model_family: string | null;
      model_name: string | null;
      year_start: number;
      year_end: number;
    }>(
      `select r.model_code, r.model_family, mn.name as model_name, r.year_start, r.year_end
         from mv_part_fitment_ranges r
         left join model_name mn
           on mn.model_code = r.model_code
          and mn.model_family is not distinct from r.model_family
        where r.part_no_normalized = $1
        order by r.model_code, r.year_start`,
      [norm]
    ),
  ]);

  if (occ.rows.length === 0 && fit.rows.length === 0) return null;

  const entry: CatalogResult = {
    part_no: norm,
    part_no_normalized: norm,
    description: null,
    component: null,
    model_count: 0,
    families: [],
    occ_count: 0,
    has_diagram: false,
    occurrences: [],
    fitment: [],
  };

  const seenOcc = new Set<string>();
  for (const row of occ.rows) {
    if (row.part_no) entry.part_no = row.part_no;
    const key = `${row.component}|${row.description}|${row.page}|${row.source_catalog}`;
    if (!seenOcc.has(key)) {
      seenOcc.add(key);
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
    if (row.diagram_url) entry.has_diagram = true;
  }
  entry.occurrences.sort(
    (a, b) =>
      (a.component ?? "").localeCompare(b.component ?? "") ||
      (a.source_catalog ?? "").localeCompare(b.source_catalog ?? "")
  );
  entry.occ_count = entry.occurrences.length;

  const codes = new Set<string>();
  const fams = new Set<string>();
  for (const row of fit.rows) {
    entry.fitment.push({
      model_code: row.model_code,
      model_family: row.model_family,
      model_name: row.model_name ?? null,
      year_start: row.year_start,
      year_end: row.year_end,
    });
    codes.add(row.model_code);
    if (row.model_family) fams.add(row.model_family);
  }
  entry.model_count = codes.size;
  entry.families = [...fams].sort((a, b) => a.localeCompare(b));

  return entry;
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
      where source_catalog = $1 || '_parts.json'
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

// Every (model code, family) with its friendly name and the year span it
// covers — used to build a family-scoped model picker on the catalog page.
export type CatalogModel = {
  code: string;
  family: string;
  name: string | null;
  year_start: number;
  year_end: number;
};

let modelsCache: CatalogModel[] | null = null;

export async function catalogModels(): Promise<CatalogModel[]> {
  if (!modelsCache) {
    const db = getDb();
    const { rows } = await db.query<{
      model_code: string;
      model_family: string | null;
      name: string | null;
      y0: number;
      y1: number;
    }>(
      // A code shows in the picker if it has a curated name, or clears a small
      // part-count bar — so the odd parse-noise code (a colour-name fragment,
      // say) that slips through the importer never becomes a pickable "model".
      `select r.model_code, r.model_family, mn.name,
              min(r.year_start) as y0, max(r.year_end) as y1
         from mv_part_fitment_ranges r
         left join model_name mn
           on mn.model_code = r.model_code
          and mn.model_family is not distinct from r.model_family
        group by r.model_code, r.model_family, mn.name
       having mn.name is not null
           or count(distinct r.part_no_normalized) >= 20
        order by r.model_family, mn.name nulls last, r.model_code`
    );
    modelsCache = rows.map((r) => ({
      code: r.model_code,
      family: r.model_family ?? "Other",
      name: r.name ?? null,
      year_start: r.y0,
      year_end: r.y1,
    }));
  }
  return modelsCache;
}

// Distinct component names (the head before the first " - " qualifier), for the
// search-bar typeahead. ~600 short strings — sent to the client once.
let componentsCache: string[] | null = null;

// Normalized component head: the text before the first " - " qualifier,
// upper-cased, with " AND " folded to " & " so the era-to-era spelling variants
// ("AIR CLEANER AND ENRICHENER" / "... & ENRICHENER") collapse to one entry.
const COMPONENT_HEAD_SQL =
  "upper(regexp_replace(regexp_replace(btrim(split_part(component, ' - ', 1)), '\\s+AND\\s+', ' & ', 'g'), '\\s{2,}', ' ', 'g'))";

export async function catalogComponents(): Promise<string[]> {
  if (!componentsCache) {
    const db = getDb();
    const { rows } = await db.query<{ c: string }>(
      `select distinct ${COMPONENT_HEAD_SQL} as c
         from catalog_part
        where component is not null and btrim(component) <> ''
        order by c`
    );
    componentsCache = rows.map((r) => r.c).filter(Boolean);
  }
  return componentsCache;
}

// The same normalized component names, with how many distinct parts and how many
// catalogs each one spans — for the browsable /catalog/components index.
export type ComponentRow = { name: string; parts: number; catalogs: number };
let componentIndexCache: ComponentRow[] | null = null;

export async function catalogComponentIndex(): Promise<ComponentRow[]> {
  if (!componentIndexCache) {
    const db = getDb();
    const { rows } = await db.query<{ name: string; parts: string; catalogs: string }>(
      `select ${COMPONENT_HEAD_SQL} as name,
              count(distinct part_no_normalized) as parts,
              count(distinct source_catalog) as catalogs
         from catalog_part
        where component is not null and btrim(component) <> ''
        group by 1
        order by 1`
    );
    componentIndexCache = rows.map((r) => ({
      name: r.name,
      parts: Number(r.parts),
      catalogs: Number(r.catalogs),
    }));
  }
  return componentIndexCache;
}

// Roll the ~565 component sections up into a couple dozen systems for a
// scan-in-one-screen view. First matching pattern wins, so the more specific /
// "grab everything for this subsystem" rules (Sidecar, Wiring) come first.
const CATEGORY_RULES: [string, RegExp][] = [
  ["Sidecar", /SIDECAR/],
  ["Wiring", /WIRING|WIRE HARNESS|HARNESS|MISCELLANEOUS ELECTRICAL|ELECTRICAL CADDY|ELECTRICAL CONTROL|CADDIES/],
  ["Exhaust", /EXHAUST/],
  ["Air Cleaner & Intake", /AIR CLEANER|ENRICHENER|ENRICHMENT|ACTIVE INTAKE/],
  ["Cooling", /RADIATOR|COOLANT|COOLING SYSTEM|WATER PUMP|THERMOSTAT/],
  ["Fuel Tank", /FUEL TANK|^CONSOLE|CONSOLE, FUEL|FUEL GAUGE|FUEL SENDER|SENDING UNIT/],
  ["Fuel System", /CARBURETOR|FUEL PUMP|FUEL INJECT|INDUCTION MODULE|THROTTLE BODY|FUEL INDUCTION|EVAPORATIVE|CALIFORNIA EVAP/],
  ["Oil System", /OIL TANK|OIL PUMP|OIL FILTER|OIL PAN|OIL LINE|OIL COOLER/],
  ["Ignition & Engine Controls", /ELECTRONIC CONTROL MODULE|\(ECM\)|IGNITION COIL|IGNITION MODULE|IGNITION SYSTEM|ELECTRONIC IGNITION|ENGINE SENSOR|SENSORS & SWITCHES|CAM POSITION|BANK ANGLE|CONTROL MODULE/],
  ["Engine — Top End", /CYLINDER|VALVE|CAMSHAFT|CAM COVER|CAM GEAR|CAM & PINION|CAM DRIVE|ROCKER|PUSH ?ROD|PUSHROD|PISTON|CONNECTING ROD|FLYWHEEL|GEARCASE/],
  ["Engine — Cases & Assembly", /CRANKCASE|ENGINE BALANCER|CRANKSHAFT|COMPLETE ENGINE|ENGINE ASSEMBLY|^ENGINE|COSMETIC COVER/],
  ["Clutch & Primary", /CLUTCH|PRIMARY HOUSING|PRIMARY COVER|ACCESS DOOR|INSPECTION COVER/],
  ["Transmission", /TRANSMISSION|SHIFTER/],
  ["Final Drive", /BELT|CHAIN|SPROCKET/],
  ["Charging & Starting", /BATTERY|ALTERNATOR|REGULATOR|STARTER/],
  ["Switches & Cruise Control", /SWITCH|CIRCUIT BREAKER|CRUISE CONTROL|TURN SIGNAL MODULE/],
  ["Lighting", /HEADLAMP|HEADLIGHT|TAIL LAMP|TAIL LIGHT|TURN SIGNAL|LICENSE PLATE|MARKER LIGHT|FOG LAMP|PASSING LAMP|PURSUIT LAMP|STROBE LAMP|AUXILIARY LAMP|AUXILIARY\/FOG|NACELLE|LAMPS &/],
  ["Instruments & Audio", /INSTRUMENT|SPEEDOMETER|TACHOMETER|SOUND SYSTEM|RADIO|ANTENNA|SPEAKER|INTERCOM|C\.?B\.? &|AMPLIFIER|INFOTAINMENT|AUDIO|MICROPHONE|HORN|SIREN|GARAGE DOOR|GAUGES/],
  ["Front Fork & Steering", /FRONT FORK|FORK, FRONT|FORK BRACKET|FORK ROCKER|STEERING HEAD/],
  ["Rear Suspension", /SHOCK ABSORBER|REAR FORK|FORK, REAR|FORK REAR|AIR SUSPENSION|SWINGARM/],
  ["Wheels & Brakes", /WHEEL|BRAKE/],
  ["Fenders", /FENDER|STRUT/],
  ["Fairing & Windshield", /FAIRING|WINDSHIELD|SPEED SCREEN/],
  ["Saddlebags & Luggage", /SADDLEBAG|LUGGAGE|TOUR.?PAK/],
  ["Seats & Backrests", /SEAT|SISSY BAR|BACKREST/],
  ["Handlebar & Mirrors", /HANDLEBAR|THROTTLE CONTROL|RISER|MIRROR/],
  ["Footrests & Floorboards", /FOOTREST|FOOTBOARD|FOOTPEG/],
  ["Frame", /FRAME|JIFFY STAND/],
  ["Trim, Covers & Labels", /SIDE COVER|AIR DEFLECTOR|COSMETIC COVER|CHIN SPOILER|LABEL|WARNING|DECAL|COVERS &|SAREE/],
  ["Hardware & Misc", /LOOSE PARTS|MISCELLANEOUS/],
];

// Front-of-bike / engine-out reading order for display (match order above is a
// separate concern).
const CATEGORY_ORDER = [
  "Engine — Top End",
  "Engine — Cases & Assembly",
  "Oil System",
  "Cooling",
  "Air Cleaner & Intake",
  "Fuel System",
  "Fuel Tank",
  "Exhaust",
  "Clutch & Primary",
  "Transmission",
  "Final Drive",
  "Ignition & Engine Controls",
  "Charging & Starting",
  "Wiring",
  "Switches & Cruise Control",
  "Lighting",
  "Instruments & Audio",
  "Front Fork & Steering",
  "Rear Suspension",
  "Wheels & Brakes",
  "Frame",
  "Handlebar & Mirrors",
  "Footrests & Floorboards",
  "Seats & Backrests",
  "Fenders",
  "Fairing & Windshield",
  "Saddlebags & Luggage",
  "Trim, Covers & Labels",
  "Sidecar",
  "Hardware & Misc",
  "Other",
];

export type ComponentCategory = {
  label: string;
  parts: number;
  members: ComponentRow[];
};

export async function catalogComponentCategories(): Promise<ComponentCategory[]> {
  const heads = await catalogComponentIndex();
  const bucket = new Map<string, ComponentRow[]>();
  for (const h of heads) {
    let label = "Other";
    for (const [l, rx] of CATEGORY_RULES) {
      if (rx.test(h.name)) {
        label = l;
        break;
      }
    }
    let arr = bucket.get(label);
    if (!arr) bucket.set(label, (arr = []));
    arr.push(h);
  }
  return CATEGORY_ORDER.filter((l) => bucket.has(l)).map((label) => {
    const members = bucket.get(label)!.slice().sort((a, b) => b.parts - a.parts || a.name.localeCompare(b.name));
    return { label, members, parts: members.reduce((n, m) => n + m.parts, 0) };
  });
}

// The ordered list of system labels, for the /catalog "System" filter.
export async function catalogCategoryLabels(): Promise<string[]> {
  return (await catalogComponentCategories()).map((c) => c.label);
}

// Resolve a system label to the component heads that roll up into it, so
// searchCatalog can filter parts by system.
async function categoryHeads(label: string | null | undefined): Promise<string[] | null> {
  if (!label) return null;
  const hit = (await catalogComponentCategories()).find((c) => c.label === label);
  return hit && hit.members.length > 0 ? hit.members.map((m) => m.name) : null;
}
