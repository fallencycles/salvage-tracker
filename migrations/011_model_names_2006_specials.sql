-- Names for codes from the 2006 special-edition batches
-- (vrod5 / softail6 / touring11 / sportster5). Keyed by
-- (model_code, model_family) like 006. Safe to re-run.

insert into model_name (model_code, name, model_family) values
  ('FLHTCUSE', 'CVO Ultra Classic Electra Glide', 'Touring'),
  ('FLSTFSE2', 'Fat Boy (Screamin'' Eagle)',       'Softail'),
  ('VRSCSE2',  'Screamin'' Eagle V-Rod',           'V-Rod'),
  ('VRXSE',    'V-Rod Destroyer',                  'V-Rod'),
  ('XL1200L',  'Sportster 1200 Low',              'Sportster')
on conflict (model_code, model_family) do nothing;
