-- Follow-up to 015: invoice payment tracking + a per-shipment activity log,
-- plus a customer_email column needed to actually send the tracking email.
-- Additive and safe to run against an existing database (IF NOT EXISTS everywhere).

alter table bol_shipment
  add column if not exists customer_email text;

alter table bol_invoice
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'disputed')),
  add column if not exists paid_at timestamptz;

-- Append-only event log for a shipment's lifecycle: quote uploaded, BOL
-- uploaded, email sent, CS note, etc. One flat table + a checked event_type,
-- not six separate log tables or a status-history clone — mirrors the
-- "trust-based, no rigid state machine" style already used elsewhere.
create table if not exists bol_shipment_activity (
  id              bigserial primary key,
  created_at      timestamptz not null default now(),
  shipment_id     bigint not null references bol_shipment(id) on delete cascade,
  event_type      text not null
    check (event_type in (
      'quote_uploaded', 'bol_uploaded', 'bill_of_sale_created',
      'invoice_matched', 'email_sent', 'status_changed', 'note'
    )),
  actor           text,  -- free-typed rep name, same convention as customer_inquiry.taken_by
  note            text,
  quote_id        bigint references bol_quote(id) on delete set null,
  invoice_line_id bigint references bol_invoice_line(id) on delete set null,
  bill_of_sale_id bigint references bol_bill_of_sale(id) on delete set null,
  metadata        jsonb  -- e.g. email_sent: {to, subject}; status_changed: {from, to}
);

create index if not exists idx_bol_shipment_activity_shipment on bol_shipment_activity(shipment_id, created_at desc);
create index if not exists idx_bol_shipment_activity_event_type on bol_shipment_activity(event_type);
create index if not exists idx_bol_invoice_payment_status on bol_invoice(payment_status);
