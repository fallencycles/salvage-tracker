# Salvage Tracker

Internal tool for tracking a bike from purchase through teardown, parts cataloging,
detailing, photography, eBay listing, sale, and returns — all keyed on the stock number
assigned at intake.

## What's here

- `schema.sql` — full Postgres schema. Run this against a fresh database first.
- Next.js 15 app router, deployable to Vercel as-is.
- `app/api/bikes/*` and `app/api/parts/*` — REST-ish routes for CRUD + status transitions.
  Every status change is logged to `status_history` automatically.
- One page per department (Intake, Teardown, Cataloging, Detailing, Photography,
  Listings, Shipping, Orders & Returns, Admin), plus a bike detail page at
  `/bikes/[stockNumber]`.
- Shipping tracks `orders.shipping_status` (`awaiting_shipment` → `shipped` →
  `delivered`, or `exception`), with carrier and tracking number captured when marked
  shipped. Every shipping status change is logged to `status_history` like everything
  else.
- Simple trust-based auth stub in `lib/auth.ts` — reads a `salvage_session` cookie,
  does NOT enforce roles at the API level yet (see below).

## Setup

1. Create a Postgres database (Vercel Postgres, Supabase, Neon, RDS, whatever you land on)
   and run `schema.sql` against it. If you already ran `schema.sql` before shipping was
   added, just run `migrations/002_add_shipping.sql` instead — it's additive and safe
   to run against a database that already has data in it.
2. Run `migrations/003_parts_catalog.sql` to create the reference parts-catalog tables,
   then load them: `node scripts/import_catalog.mjs` (reads `data/fallen_cycles_catalog.db`,
   re-runnable — it truncates and reloads). Powers the `/catalog` page.
3. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL`.
   - Supabase: use the **transaction pooler** string (`...pooler.supabase.com:6543`) for
     anything deployed; the direct `db.<ref>.supabase.co:5432` host is IPv6-only. `lib/db.ts`
     connects with `ssl: { rejectUnauthorized: false }` for non-local hosts since Supabase's
     chain isn't in Node's CA bundle.
4. `npm install`
5. `npm run dev`

## What's stubbed and needs real work next

- **Auth.** Right now `getCurrentUser()` just reads a cookie you'd need to set at login —
  there's no login page yet. Decide: build a minimal login page against your `users`
  table, or wire up Supabase Auth and map its session to a role lookup. Since role
  separation is trust-based, the API routes don't
  currently reject anyone — `requireRole()` in `lib/auth.ts` is a no-op placeholder for
  when/if that needs to change.
- **Photo upload + watermarking.** No upload endpoint yet. Plan: an API route that
  accepts a file, runs it through `sharp` to burn in the stock number, and pushes it to
  object storage at a path like `/photos/{stock_number}/{part_id}/`. `sharp` is already
  in `package.json`.
- **eBay integration.** No calls to eBay yet. You'll need Developer API access
  (Inventory API for listings, Trading API or the newer Post-Order API for
  orders/returns). The `listings` and `orders` tables are shaped to hold eBay's IDs
  once that's wired up — `ebay_listing_id` and `ebay_order_id` are just sitting there
  waiting for real sync logic.
- **Cataloging flow.** The `/cataloging` page currently just shows bikes marked
  `cataloged` — there's no UI yet for actually creating the individual `parts` rows
  during teardown. That's probably the next page to build out properly, since it's
  where a bike stops being one record and becomes many.
- **Reporting.** The `status_history` table gives you everything needed for
  "how long does teardown usually take" type reports — nothing built on top of it yet.

## Notes on conventions

- `stock_number` is a `text` primary key on `bikes`, not a surrogate ID — it's the
  business key referenced everywhere (photo storage paths, eBay listing titles/
  watermarks, this UI). Keep it that way; don't introduce a separate internal ID for
  bikes.
- Every status transition (bike or part) goes through `/api/{entity}/{id}/status` so
  the audit log stays consistent — don't update `.status` directly from a new code path
  without also writing to `status_history`.
