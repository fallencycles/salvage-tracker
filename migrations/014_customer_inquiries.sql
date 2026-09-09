-- Customer inquiry log — what a customer asked for on a phone call. One
-- customer_inquiry row per call (contact details + the motorcycle they're
-- working on), with one or more customer_inquiry_part rows hanging off it
-- (the OEM part numbers / descriptions they need). Powers the /inquiries page
-- and its "Download CSV" export.
--
-- Additive and safe to run against an existing database (IF NOT EXISTS
-- everywhere).

create table if not exists customer_inquiry (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  customer_name text,
  phone         text,
  email         text,
  company       text,
  moto_year     text,
  moto_make     text,
  moto_model    text,
  taken_by      text,
  notes         text,
  status        text not null default 'open'
);

create table if not exists customer_inquiry_part (
  id              bigserial primary key,
  inquiry_id      bigint not null references customer_inquiry(id) on delete cascade,
  position        int not null default 0,
  oem_part_number text,
  description     text,
  qty             int,
  notes           text,
  -- Where this line came from, so more datasets can feed it later without a
  -- schema change: 'manual' (typed on the phone), 'catalog' (picked from the
  -- reference parts catalog), 'ebay' (future — matched to a live listing).
  source          text not null default 'manual',
  -- Soft link to the reference catalog (catalog_part.part_no_normalized). NOT a
  -- foreign key on purpose: scripts/import_catalog.mjs truncates and reloads
  -- catalog_part on every refresh, which a FK constraint would block.
  catalog_part_no text,
  -- Generic external identifier slot for future integrations (an eBay item or
  -- listing id, a supplier SKU, ...). Paired with `source` to say what it is.
  source_ref      text,
  -- Fulfillment state for the eventual pick list:
  -- needed -> sourced -> picked -> fulfilled (or 'cancelled').
  status          text not null default 'needed'
);

create index if not exists idx_customer_inquiry_created
  on customer_inquiry (created_at desc);
create index if not exists idx_customer_inquiry_part_inquiry
  on customer_inquiry_part (inquiry_id);
create index if not exists idx_customer_inquiry_part_catalog_no
  on customer_inquiry_part (catalog_part_no);
create index if not exists idx_customer_inquiry_part_status
  on customer_inquiry_part (status);
