-- Reference parts catalog — a fixed Harley part-number dataset (part numbers,
-- the catalog components they appear under, and the model/year ranges each one
-- fits). Imported from fallen_cycles_catalog.db by scripts/import_catalog.mjs
-- and treated as read-only at runtime.
--
-- Safe to run against an existing database (IF NOT EXISTS everywhere). The
-- import script truncates and reloads these three tables, so re-importing does
-- not require re-running this file.

create table if not exists catalog_part (
  id                 bigint primary key,
  model_family       text,
  catalog_year_start int,
  catalog_year_end   int,
  source_catalog     text,
  component          text,
  index_no           text,
  part_no            text,
  part_no_normalized text,
  description        text,
  models_raw         text,
  international       boolean not null default false,
  page               int,
  -- Full-text search vector over the fields people actually search by. Replaces
  -- the SQLite FTS5 virtual table. Maintained automatically.
  search tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(description, '') || ' ' ||
      coalesce(component, '') || ' ' ||
      coalesce(part_no_normalized, '')
    )
  ) stored
);

create table if not exists catalog_part_fitment (
  catalog_part_id    bigint,
  part_no_normalized text,
  model_code         text,
  model_year         int,
  model_family       text
);

-- Pre-collapsed fitment: one row per part + model_code + contiguous year span.
create table if not exists mv_part_fitment_ranges (
  part_no_normalized text,
  model_code         text,
  model_family       text,
  year_start         int,
  year_end           int,
  years_confirmed    int
);

create index if not exists idx_catalog_part_norm
  on catalog_part (part_no_normalized);
-- text_pattern_ops so left-anchored LIKE 'ABC%' part-number lookups use an index
-- regardless of the database locale.
create index if not exists idx_catalog_part_norm_prefix
  on catalog_part (part_no_normalized text_pattern_ops);
create index if not exists idx_catalog_part_search
  on catalog_part using gin (search);
create index if not exists idx_catalog_fitment_norm
  on catalog_part_fitment (part_no_normalized);
create index if not exists idx_mv_ranges_norm
  on mv_part_fitment_ranges (part_no_normalized);
create index if not exists idx_mv_ranges_model_year
  on mv_part_fitment_ranges (model_code, year_start, year_end);
