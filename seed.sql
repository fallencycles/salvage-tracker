-- Development seed data for Salvage Tracker.
-- Safe to re-run: truncates the working tables first.
-- Load with:  psql -d salvage_tracker -f seed.sql

begin;

truncate returns, orders, listings, photos, parts, status_history, bikes, users restart identity cascade;

-- Users -------------------------------------------------------------------------
-- Placeholder addresses on fallencycles.test — swap for real ones when auth is wired up.
insert into users (name, email, role, active) values
  ('Alan Prewitt',  'alan@fallencycles.test', 'admin',            true),
  ('Rosa Delgado',  'rosa@fallencycles.test', 'intake',           true),
  ('Mike Chen',     'mike@fallencycles.test', 'teardown',         true),
  ('Tara Boone',    'tara@fallencycles.test', 'detailing',        true),
  ('Wes Kowalski',  'wes@fallencycles.test',  'photography',      true),
  ('Nina Ortiz',    'nina@fallencycles.test', 'listing',          true),
  ('Kofi Adjei',    'kofi@fallencycles.test', 'customer_service', false);

-- Bikes, one or more per pipeline stage ---------------------------------------
insert into bikes (stock_number, make, model, year, purchase_source, purchase_price, purchase_date, status) values
  ('SV-1043', 'Yamaha',   'YZF-R6',        2016, 'Copart Nashville',       2100.00, '2026-09-02', 'intake'),
  ('SV-1044', 'Honda',    'CB500F',        2019, 'IAA Memphis',           1850.00, '2026-09-03', 'intake'),
  ('SV-1045', 'KTM',      '690 Duke',      2014, 'Facebook Marketplace',  1400.00, '2026-09-05', 'intake'),
  ('SV-1041', 'Honda',    'CBR600RR',      2014, 'Copart Nashville',      2400.00, '2026-08-26', 'teardown'),
  ('SV-1039', 'Kawasaki', 'Ninja 650',     2018, 'IAA Memphis',          2650.00, '2026-08-24', 'teardown'),
  ('SV-1038', 'Yamaha',   'MT-07',         2015, 'Copart Atlanta',       2200.00, '2026-08-22', 'teardown'),
  ('SV-1037', 'Suzuki',   'SV650',         2017, 'Local pickup',         1950.00, '2026-08-21', 'teardown'),
  ('SV-1036', 'Kawasaki', 'Z1000',         2013, 'Copart Nashville',     2300.00, '2026-08-19', 'teardown'),
  ('SV-1035', 'Suzuki',   'GSX-R750',      2012, 'Copart Nashville',     1750.00, '2026-08-14', 'cataloged'),
  ('SV-1033', 'Aprilia',  'RS 660',        2016, 'IAA Atlanta',          3100.00, '2026-08-11', 'cataloged'),
  ('SV-1030', 'KTM',      '390 Duke',      2019, 'Facebook Marketplace', 1500.00, '2026-08-06', 'detailing'),
  ('SV-1028', 'Triumph',  'Street Triple', 2015, 'Copart Nashville',     3400.00, '2026-08-01', 'photo_ready'),
  ('SV-1022', 'Ducati',   'Monster 821',   2017, 'IAA Memphis',          4200.00, '2026-07-20', 'listed'),
  ('SV-1015', 'Harley-Davidson', 'Sportster 883', 2013, 'Local pickup',  2800.00, '2026-07-05', 'partial_sold'),
  ('SV-1004', 'BMW',      'F800GS',        2011, 'Copart Atlanta',       2600.00, '2026-06-12', 'closed');

-- Parts for the cataloged / downstream bikes ---------------------------------
insert into parts (stock_number, part_name, category, condition, asking_price, sold_price, status) values
  ('SV-1035', 'Front fairing',        'Bodywork',   'good',  220.00, null,   'photographed'),
  ('SV-1035', 'Left clip-on',         'Controls',   'good',   45.00, null,   'listed'),
  ('SV-1035', 'Tail section',         'Bodywork',   'fair',  180.00, null,   'detailed'),
  ('SV-1035', 'Front forks (pair)',   'Suspension', 'good',  340.00, null,   'pending'),
  ('SV-1035', 'Instrument cluster',   'Electrical', 'good',  160.00, 160.00, 'sold'),
  ('SV-1035', 'Exhaust mid-pipe',     'Exhaust',    'fair',   90.00, null,   'pending'),
  ('SV-1030', 'Front fairing',        'Bodywork',   'good',  260.00, null,   'pending'),
  ('SV-1030', 'Swingarm',             'Chassis',    'good',  150.00, null,   'pending'),
  ('SV-1030', 'Headlight assembly',   'Electrical', 'good',   95.00, null,   'detailed'),
  ('SV-1028', 'Subframe',             'Chassis',    'good',  120.00, null,   'detailed'),
  ('SV-1028', 'Fuel tank',            'Bodywork',   'good',  210.00, 210.00, 'sold'),
  ('SV-1022', 'Triple clamp',         'Suspension', 'good',  130.00, null,   'photographed'),
  ('SV-1022', 'Rear wheel',           'Wheels',     'good',  260.00, 260.00, 'return_pending'),
  ('SV-1015', 'Instrument cluster',   'Electrical', 'fair',  175.00, 175.00, 'return_pending'),
  ('SV-1041', 'Front brake calipers', 'Brakes',     'good',  145.00, 145.00, 'sold');

-- Listings + orders + returns for the sold parts ----------------------------
insert into listings (part_id, ebay_listing_id, listing_status, listed_price, listed_at, last_synced_at)
select id, 'EB-' || substr(md5(random()::text), 1, 10), 'active', asking_price, now() - interval '9 days', now()
from parts where status in ('sold', 'return_pending', 'listed', 'photographed');

insert into orders (listing_id, ebay_order_id, buyer_name, buyer_email, sale_price, order_status, sold_at)
select l.id, 'ORD-' || substr(md5(random()::text), 1, 8), b.buyer_name, b.buyer_email, p.sold_price, 'paid', b.sold_at
from listings l
join parts p on p.id = l.part_id
join (values
  ('SV-1015', 'Instrument cluster',   'Dana Whitfield', 'dana.w@example.com',  timestamptz '2026-09-04 15:20'),
  ('SV-1022', 'Rear wheel',           'Marco Reyes',    'mreyes@example.com',  timestamptz '2026-09-01 11:05'),
  ('SV-1028', 'Fuel tank',            'Priya Nair',     'priya.n@example.com', timestamptz '2026-08-29 09:44'),
  ('SV-1035', 'Instrument cluster',   'Sam Alderton',   'salderton@example.com', timestamptz '2026-08-27 18:12'),
  ('SV-1041', 'Front brake calipers', 'Jordan Vale',    'jvale@example.com',   timestamptz '2026-08-23 13:30')
) as b(stock_number, part_name, buyer_name, buyer_email, sold_at)
  on b.stock_number = p.stock_number and b.part_name = p.part_name
where p.sold_price is not null;

insert into returns (order_id, reason, status, created_at)
select o.id, r.reason, r.status, r.created_at
from orders o
join listings l on l.id = o.listing_id
join parts p on p.id = l.part_id
join (values
  ('SV-1015', 'Instrument cluster', 'Item not as described - cracked lens', 'open',       timestamptz '2026-09-05 10:00'),
  ('SV-1022', 'Rear wheel',         'Wrong fitment',                        'resolving',  timestamptz '2026-09-02 16:40')
) as r(stock_number, part_name, reason, status, created_at)
  on r.stock_number = p.stock_number and r.part_name = p.part_name;

-- Shipping state on the existing orders (migration 002 defaults everything to
-- 'awaiting_shipment'; move a couple forward so the Shipping page has both tables) -
update orders o set shipping_status = 'delivered', carrier = 'UPS',  tracking_number = '1Z999AA10123456784',
  shipped_at = timestamptz '2026-08-24 09:15', delivered_at = timestamptz '2026-08-27 14:02'
from listings l join parts p on p.id = l.part_id
where l.id = o.listing_id and p.stock_number = 'SV-1041' and p.part_name = 'Front brake calipers';

update orders o set shipping_status = 'shipped', carrier = 'USPS', tracking_number = '9400111899223817200001',
  shipped_at = timestamptz '2026-08-30 11:40'
from listings l join parts p on p.id = l.part_id
where l.id = o.listing_id and p.stock_number = 'SV-1028' and p.part_name = 'Fuel tank';

-- Audit trail for a couple of bikes, plus the two shipping transitions above ----
insert into status_history (entity_type, entity_id, from_status, to_status, note, changed_at) values
  ('bike', 'SV-1035', null,       'intake',    'Bike created at intake', '2026-08-14 11:02'),
  ('bike', 'SV-1035', 'intake',   'teardown',  null,                    '2026-08-14 14:45'),
  ('bike', 'SV-1035', 'teardown', 'cataloged', null,                    '2026-08-16 09:12'),
  ('bike', 'SV-1041', null,       'intake',    'Bike created at intake', '2026-08-26 08:30'),
  ('bike', 'SV-1041', 'intake',   'teardown',  null,                    '2026-08-26 15:10');

insert into status_history (entity_type, entity_id, from_status, to_status, changed_at)
select 'order', o.id::text, 'awaiting_shipment', 'shipped', o.shipped_at
from orders o where o.shipped_at is not null;
insert into status_history (entity_type, entity_id, from_status, to_status, changed_at)
select 'order', o.id::text, 'shipped', 'delivered', o.delivered_at
from orders o where o.delivered_at is not null;

commit;
