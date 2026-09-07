-- Salvage Tracker schema
-- Everything keys off stock_number (the bike's identity throughout the whole process).

create type user_role as enum (
  'intake', 'teardown', 'detailing', 'photography', 'listing', 'customer_service', 'admin'
);

create type bike_status as enum (
  'intake', 'teardown', 'cataloged', 'detailing', 'photo_ready', 'listed', 'partial_sold', 'closed'
);

create type part_status as enum (
  'pending', 'detailed', 'photographed', 'listed', 'sold', 'return_pending', 'returned', 'refunded', 'closed'
);

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  role user_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- The bike itself. stock_number is the business key used everywhere (watermarks, storage paths, etc).
create table bikes (
  stock_number text primary key,
  vin text,
  make text,
  model text,
  year int,
  purchase_source text,
  purchase_price numeric(10,2),
  purchase_date date,
  status bike_status not null default 'intake',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table parts (
  id uuid primary key default gen_random_uuid(),
  stock_number text not null references bikes(stock_number) on delete cascade,
  part_name text not null,
  category text,
  condition text,
  asking_price numeric(10,2),
  sold_price numeric(10,2),
  status part_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references parts(id) on delete cascade,
  storage_path text not null,
  watermarked boolean not null default false,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table listings (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references parts(id) on delete cascade,
  ebay_listing_id text,
  listing_status text not null default 'draft',
  listed_price numeric(10,2),
  listed_at timestamptz,
  last_synced_at timestamptz
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id),
  ebay_order_id text,
  buyer_name text,
  buyer_email text,
  sale_price numeric(10,2),
  order_status text not null default 'pending',
  sold_at timestamptz not null default now(),
  -- Shipping
  shipping_status text not null default 'awaiting_shipment', -- awaiting_shipment, shipped, delivered, exception
  carrier text,
  tracking_number text,
  shipping_address text,
  shipped_at timestamptz,
  delivered_at timestamptz
);

create table returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  reason text,
  status text not null default 'open',
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Append-only audit trail. Every status transition on a bike or a part gets logged here.
create table status_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('bike', 'part', 'order')),
  entity_id text not null,
  from_status text,
  to_status text not null,
  changed_by uuid references users(id),
  note text,
  changed_at timestamptz not null default now()
);

create index idx_parts_stock_number on parts(stock_number);
create index idx_photos_part_id on photos(part_id);
create index idx_listings_part_id on listings(part_id);
create index idx_orders_listing_id on orders(listing_id);
create index idx_status_history_entity on status_history(entity_type, entity_id);
