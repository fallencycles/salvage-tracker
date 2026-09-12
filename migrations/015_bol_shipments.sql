-- Worldwide Express freight (LTL) BOL / quote / invoice reconciliation.
-- Additive and safe to run against an existing database (IF NOT EXISTS everywhere).

create table if not exists bol_shipment (
  id                     bigserial primary key,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- Soft link to bikes(stock_number), like catalog_part_no on customer_inquiry_part —
  -- typed by hand for now, not a hard FK, until intake is wired to the scanned
  -- stock-number sheets.
  stock_number           text,
  -- Nullable: some freight sales (phone/wholesale/local deals) never go through
  -- the listings/orders pipeline, so not every shipment has a matching orders row.
  order_id               uuid references orders(id),
  customer_name          text,        -- also the key used to match against bol_quote
  carrier                text,
  ship_date              date,
  freight_terms          text,
  ship_from_name         text,
  ship_from_address      text,
  ship_from_contact      text,
  ship_to_name           text,
  ship_to_address        text,
  ship_to_contact        text,
  origin_terminal        text,
  destination_terminal   text,
  special_instructions   text,
  pickup_instructions    text,
  delivery_instructions  text,
  bol_number             text,
  pro_number             text,
  pro_sticker_photo_path text,
  status                 text not null default 'quoted'
    -- quoted -> booked -> picked_up -> invoiced -> reconciled
);

create table if not exists bol_quote (
  id                    bigserial primary key,
  created_at            timestamptz not null default now(),
  shipment_id           bigint references bol_shipment(id) on delete set null,
  quote_number          text,
  quote_date            date,
  valid_until           date,
  customer_name         text,   -- matched against bol_shipment.customer_name
  carrier               text,
  service               text,
  transit_days          int,
  pickup_date           date,
  origin_terminal       text,
  destination_terminal  text,
  qty                   int,
  weight_lbs            numeric(10,2),
  nmfc                  text,
  description           text,
  class                 text,
  estimated_price       numeric(10,2)
);

create table if not exists bol_invoice (
  id             bigserial primary key,
  created_at     timestamptz not null default now(),
  invoice_number text unique,
  invoice_date   date,
  due_date       date,
  account_number text,
  amount_due     numeric(10,2)
);

-- One row per LTL freight line on an invoice. UPS small-package lines (no
-- BOL#/PRO#) are not imported here at all.
create table if not exists bol_invoice_line (
  id             bigserial primary key,
  invoice_id     bigint not null references bol_invoice(id) on delete cascade,
  shipment_id    bigint references bol_shipment(id) on delete set null, -- matched by bol_number
  ship_date      date,
  bol_number     text,
  pro_number     text,
  class          text,
  nmfc           text,
  shipper_name   text,
  receiver_name  text,
  pieces         int,
  description    text,
  weight_lbs     numeric(10,2),
  dims           text,
  line_total     numeric(10,2)
);

-- Every itemized charge on a freight line, captured individually so extra
-- charges can be identified by type (FUEL SURCHARGE, RE-CLASS, INSPECTION
-- CHARGE, CARB COMPLIANCE FEE, INSURANCE COVERAGE, ...), not just a total.
create table if not exists bol_invoice_charge (
  id               bigserial primary key,
  invoice_line_id  bigint not null references bol_invoice_line(id) on delete cascade,
  charge_type      text not null,
  amount           numeric(10,2) not null
);

create table if not exists bol_bill_of_sale (
  id                bigserial primary key,
  created_at        timestamptz not null default now(),
  shipment_id       bigint references bol_shipment(id) on delete set null,
  sale_date         date,
  customer_name     text,
  customer_address  text,
  customer_contact  text,
  item_description  text,
  vin               text,
  serial_number     text,
  mileage           text,
  item_price        numeric(10,2),
  shipping          numeric(10,2),
  sales_tax         numeric(10,2),
  total             numeric(10,2)
);

create index if not exists idx_bol_shipment_stock_number on bol_shipment(stock_number);
create index if not exists idx_bol_shipment_bol_number on bol_shipment(bol_number);
create index if not exists idx_bol_shipment_customer_name on bol_shipment(customer_name);
create index if not exists idx_bol_quote_shipment on bol_quote(shipment_id);
create index if not exists idx_bol_quote_customer_name on bol_quote(customer_name);
create index if not exists idx_bol_invoice_line_invoice on bol_invoice_line(invoice_id);
create index if not exists idx_bol_invoice_line_shipment on bol_invoice_line(shipment_id);
create index if not exists idx_bol_invoice_line_bol_number on bol_invoice_line(bol_number);
create index if not exists idx_bol_invoice_charge_line on bol_invoice_charge(invoice_line_id);
create index if not exists idx_bol_bill_of_sale_shipment on bol_bill_of_sale(shipment_id);
