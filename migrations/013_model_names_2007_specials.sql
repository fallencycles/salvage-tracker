-- Names for codes from the 2007 batches
-- (dyna7 / softail7 / touring12 / sportster6). Keyed by
-- (model_code, model_family) like 006. Safe to re-run.

insert into model_name (model_code, name, model_family) values
  ('FLHPE',     'Police Road King (EFI)',              'Touring'),
  ('FLHTP',     'Police Electra Glide',                'Touring'),
  ('FLHRSE3',   'CVO Road King',                       'Touring'),
  ('FLHTCUSE2', 'CVO Ultra Classic Electra Glide',     'Touring'),
  ('FXDSE',     'CVO Dyna',                            'Dyna'),
  ('FXSTSSE',   'Springer Softail (Screamin'' Eagle)', 'Softail'),
  ('XL1200N',   'Sportster 1200 Nightster',            'Sportster'),
  ('XL50',      'Sportster 50th Anniversary',          'Sportster')
on conflict (model_code, model_family) do nothing;
