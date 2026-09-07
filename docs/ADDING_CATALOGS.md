# Adding parts catalogs for new bike models

How to package a batch of catalog data so it can be imported into the app with
minimal back-and-forth. The parts catalog and its diagrams live in Supabase
(Postgres + Storage); the app reads them live, so **importing new data does not
require a redeploy**.

## Drop location

One batch = all catalogs for a model line. Put everything in:

```
/Users/home/Developer/Fallen Cycles/incoming/<model-line>/
```

## Files to include

### 1. Parts data — one of:

- **`parts.db`** — SQLite, same schema as `data/fallen_cycles_catalog.db`, with
  tables `catalog_part` and `catalog_part_fitment` containing the new catalogs
  only. `mv_part_fitment_ranges` is optional — it gets rebuilt from
  `catalog_part_fitment`.
- **or** `catalog_part.ndjson` + `catalog_part_fitment.ndjson` — one JSON object
  per line — if producing SQLite is inconvenient.

`catalog_part` columns: `model_family, catalog_year_start, catalog_year_end,
source_catalog, component, index_no, part_no, part_no_normalized, description,
models_raw, international, page` (`id` and the `search` tsvector are generated on
import).

`catalog_part_fitment` columns: `part_no_normalized, model_code, model_year,
model_family` (`catalog_part_id` is linked on import).

### 2. `component_images.json` — new catalogs only

```json
[
  {
    "catalog": "sportster_2004",
    "component": "ENGINE ASSEMBLY - COMPLETE",
    "page": 9,
    "image_file": "sportster_2004_ENGINE_ASSEMBLY_COMPLETE_p9.png"
  }
]
```

One entry per distinct `(catalog, component)` — the exploded-view diagram for
that section.

### 3. `<slug>_diagrams.zip` — one per catalog

Flat PNGs (no subfolders). Filenames must match `image_file` in
`component_images.json` exactly. Extra/junk files in the zip are ignored — the
importer walks the JSON, not the zip.

### 4. `manifest.json`

```json
{
  "model_line": "Sportster",
  "additive": true,
  "catalogs": [
    {
      "slug": "sportster_2004",
      "model_family": "Sportster",
      "year_start": 2004,
      "year_end": 2004,
      "model_codes": ["XL883", "XL883C", "XL1200C", "XL1200R"]
    },
    {
      "slug": "sportster_2005-2006",
      "model_family": "Sportster",
      "year_start": 2005,
      "year_end": 2006,
      "model_codes": ["XL883", "XL883L", "XL1200C", "XL1200R"]
    }
  ],
  "parts_file": "parts.db",
  "component_images_index": "component_images.json",
  "diagram_zips": [
    "sportster_2004_diagrams.zip",
    "sportster_2005-2006_diagrams.zip"
  ],
  "source": "2004 & 2005-2006 Sportster parts catalog PDFs"
}
```

## Matching rules — the parts that break if they're off

| Field | Rule |
| --- | --- |
| **catalog slug** | lowercase, `_`-separated, e.g. `sportster_2004`, `dyna_2012-2013`, `touring_2010`. In parts data, `source_catalog` = `<slug>_parts.json`. In `component_images.json`, `catalog` = `<slug>`. They must agree. |
| **component** | **Byte-identical** between the parts rows and `component_images.json` for the same catalog — `™`, `®`, punctuation, spacing, capitalization all count. One mismatched character = that part shows no diagram. This is the #1 failure mode. |
| **part_no** | As printed in the catalog. `part_no_normalized` = uppercase with non-alphanumerics removed (`16116-00` -> `1611600`). Include it if you already compute it, otherwise it's derived. |
| **coverage** | Every distinct `(catalog, component)` in the parts data should have exactly one row in `component_images.json`, and every image row should match a component in the parts data. |
| **model_code / model_family** | `model_code` = specific designation (`XL883`, `FXST`). `model_family` = the line (`Sportster`, `Dyna`, `Softail`, `Touring`) and populates the `/catalog` model-filter dropdown automatically — no code change to add a new family. |

## The message to send

> New catalog batch in `incoming/sportster/` — see manifest.json. Additive.
> Import to Supabase and run the sanity checks.

## What happens on import

Runs `scripts/import_catalog_batch.mjs` (`BATCH_DIR=incoming node scripts/import_catalog_batch.mjs`):

1. Validate the manifest and component-string matching **before** writing to the DB.
2. Load `catalog_part` + `catalog_part_fitment` additively — refuses to run if any
   of the batch's `source_catalog` values already exist; new ids are the SQLite
   ids offset past the current `MAX(catalog_part.id)`. (The original one-shot
   `scripts/import_catalog.mjs` truncates and is not used for batches.)
3. Recompute `mv_part_fitment_ranges` (gaps-and-islands) for every part number the
   batch touches, across the whole fitment table — so a part shared with older
   catalogs gets one correct set of ranges.
4. Upload the PNGs to the existing public `catalog-diagrams` Storage bucket and
   upsert `catalog_component_image` (unique on `catalog, component`); PNGs already
   in the bucket are skipped.
5. Run coverage sanity checks (row counts match the index; no orphans in either
   direction) and spot-check parts on the live site.
6. No redeploy. The only code change that might be needed is widening the
   `/catalog` year filter (currently `1991`–`2026` in `components/CatalogSearch.tsx`)
   if a catalog falls outside that span.

## If you don't have SQLite / NDJSON

Send whatever intermediate format the processing pipeline produces (raw JSON,
CSV, even the parsed PDF text) and describe its shape — the loader gets written
to match it.

## Reference: how the pieces join

```
catalog_part.source_catalog            "sportster_2004_parts.json"
  -> strip "_parts.json"            =>  "sportster_2004"
                                        |
catalog_component_image.catalog    ----+  (+ identical .component)
  -> .image_url                        =>  public URL in the catalog-diagrams bucket
```

The catalog data currently loaded: Touring (2000) and Softail (1991-1992 through
2020, plus 2022, 2025, 2026) — 29 catalogs, ~10,598 distinct parts, 2,640
component diagrams.
