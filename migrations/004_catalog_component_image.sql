-- Exploded-view diagram per catalog component (one image per component per
-- catalog year). Populated by scripts/import_component_images.mjs from
-- data/all_component_images.json + a folder of PNGs uploaded to Supabase Storage.
--
-- Additive. Joined to catalog_part on (catalog, component), where the catalog
-- slug is catalog_part.source_catalog with the trailing "_parts.json" removed
-- (e.g. "softail_2004_parts.json" -> "softail_2004", "touring_parts.json" ->
-- "touring").

create table if not exists catalog_component_image (
  id          bigint generated always as identity primary key,
  catalog     text not null,
  component   text not null,
  page        int,
  image_url   text not null,
  created_at  timestamptz not null default now()
);

-- One diagram per (catalog, component).
create unique index if not exists uq_component_image_catalog_component
  on catalog_component_image (catalog, component);

-- Lookup path used by the catalog search join.
create index if not exists idx_component_image_lookup
  on catalog_component_image (catalog, component);
