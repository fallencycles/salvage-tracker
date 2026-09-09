-- Names for codes from the 2004-2005 special-edition batches
-- (vrod4 / softail5 / touring10 / sportster3). Keyed by
-- (model_code, model_family) like 006. Safe to re-run.

insert into model_name (model_code, name, model_family) values
  ('FLHTCSE',  'CVO Electra Glide',               'Touring'),
  ('FLHTCSE2', 'CVO Electra Glide',               'Touring'),
  ('FXSTDSE2', 'Softail Deuce (Screamin'' Eagle)', 'Softail'),
  ('FLSTFSE',  'Fat Boy (Screamin'' Eagle)',       'Softail'),
  ('VRSCSE',   'Screamin'' Eagle V-Rod',           'V-Rod'),
  ('XL883L',   'Sportster 883 Low',               'Sportster'),
  ('XL1200R',  'Sportster 1200 Roadster',         'Sportster')
on conflict (model_code, model_family) do nothing;
