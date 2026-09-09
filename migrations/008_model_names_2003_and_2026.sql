-- Friendly names for codes surfaced by later batches. Keyed by
-- (model_code, model_family) like 006. Safe to re-run.

insert into model_name (model_code, name, model_family) values
  -- 2003 special editions
  ('FLHRSEI2', 'CVO Road King',                    'Touring'),
  ('FXSTDSE',  'Softail Deuce (Screamin'' Eagle)', 'Softail'),
  -- 2026 model codes (confirmed by the shop)
  ('FLHXL',    'Street Glide Limited',             'Touring'),
  ('FLTRXL',   'Road Glide Limited',               'Touring'),
  ('FLHD',     'Softail Deadwood',                 'Softail'),
  ('FXD',      'Softail Super Glide',              'Softail')
on conflict (model_code, model_family) do nothing;
