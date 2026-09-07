-- Adds shipping tracking to orders. Safe to run against an existing database
-- that already has the base schema applied (uses IF NOT EXISTS everywhere).

alter table orders add column if not exists shipping_status text not null default 'awaiting_shipment';
alter table orders add column if not exists carrier text;
alter table orders add column if not exists tracking_number text;
alter table orders add column if not exists shipping_address text;
alter table orders add column if not exists shipped_at timestamptz;
alter table orders add column if not exists delivered_at timestamptz;

-- Allow 'order' entities in the audit trail (shipping status changes get logged there too).
alter table status_history drop constraint if exists status_history_entity_type_check;
alter table status_history add constraint status_history_entity_type_check
  check (entity_type in ('bike', 'part', 'order'));

create index if not exists idx_orders_shipping_status on orders(shipping_status);
