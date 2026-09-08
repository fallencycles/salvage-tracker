-- Model codes are reused across families (FXD is both a 1990s Dyna Super Glide
-- and a 2026 Softail code), so key the friendly names by (model_code,
-- model_family) instead of model_code alone. Safe to re-run.

alter table model_name alter column model_family set default 'Unknown';
update model_name set model_family = 'Unknown' where model_family is null;
alter table model_name alter column model_family set not null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'model_name'::regclass and contype = 'p'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (model_code)'
  ) then
    alter table model_name drop constraint model_name_pkey;
    alter table model_name add constraint model_name_pkey primary key (model_code, model_family);
  end if;
end $$;

-- Dyna friendly names (1991-2010). Codes with a long life get their
-- longest-lived name (FXDB was Sturgis in '91-'92, then Street Bob; FXDC was
-- Daytona in '92, then Super Glide Custom). Editable.
insert into model_name (model_code, name, model_family) values
  ('FXD',    'Dyna Super Glide',                  'Dyna'),
  ('FXDI',   'Dyna Super Glide (EFI)',            'Dyna'),
  ('FXDB',   'Dyna Street Bob',                   'Dyna'),
  ('FXDBI',  'Dyna Street Bob (EFI)',             'Dyna'),
  ('FXDC',   'Dyna Super Glide Custom',           'Dyna'),
  ('FXDCI',  'Dyna Super Glide Custom (EFI)',     'Dyna'),
  ('FXDL',   'Dyna Low Rider',                    'Dyna'),
  ('FXDLI',  'Dyna Low Rider (EFI)',              'Dyna'),
  ('FXDS',   'Dyna Convertible',                  'Dyna'),
  ('FXDWG',  'Dyna Wide Glide',                   'Dyna'),
  ('FXDWGI', 'Dyna Wide Glide (EFI)',             'Dyna'),
  ('FXDX',   'Dyna Super Glide Sport',            'Dyna'),
  ('FXDXI',  'Dyna Super Glide Sport (EFI)',      'Dyna'),
  ('FXDXT',  'Dyna Super Glide T-Sport',          'Dyna'),
  ('FXDF',   'Dyna Fat Bob',                      'Dyna'),
  ('FXD35',  'Dyna 35th Anniversary Super Glide', 'Dyna'),
  ('FLD',    'Dyna Switchback',                   'Dyna'),
  ('FXDLS',  'Dyna Low Rider S',                  'Dyna'),
  ('FXDBA',  'Dyna Street Bob (special edition)', 'Dyna'),
  ('FXDBB',  'Dyna Street Bob (special edition)', 'Dyna'),
  ('FXDBC',  'Dyna Street Bob (special edition)', 'Dyna'),
  ('FXDBP',  'Dyna Street Bob (special edition)', 'Dyna'),
  -- V-Rod / VRSC (2002-2008). The importer maps source family "VRSC" -> "V-Rod".
  ('VRSCA',   'V-Rod',                    'V-Rod'),
  ('VRSCB',   'V-Rod',                    'V-Rod'),
  ('VRSCAW',  'V-Rod (wide front tire)',  'V-Rod'),
  ('VRSCAWA', 'V-Rod (ABS)',              'V-Rod'),
  ('VRSCD',   'Night Rod',                'V-Rod'),
  ('VRSCDA',  'Night Rod (ABS)',          'V-Rod'),
  ('VRSCDX',  'Night Rod Special',        'V-Rod'),
  ('VRSCDXA', 'Night Rod Special (ABS)',  'V-Rod'),
  ('VRSCR',   'Street Rod',               'V-Rod'),
  ('VRSCX',   'Screamin'' Eagle V-Rod',   'V-Rod'),
  ('VRSCF',   'V-Rod Muscle',             'V-Rod'),
  -- Dyna FXDWG/FXDP special editions
  ('FXDWG2', 'Dyna Wide Glide (2001 special edition)', 'Dyna'),
  ('FXDWG3', 'Dyna Wide Glide (2002 special edition)', 'Dyna'),
  ('FXDP',   'Dyna Defender (police)',    'Dyna'),
  -- FXR (2000 FXR4 revival)
  ('FXR4',   'FXR4',                      'FXR'),
  -- Sportster (2000-2002)
  ('XL883',    'Sportster 883',           'Sportster'),
  ('XL883C',   'Sportster 883 Custom',    'Sportster'),
  ('XL883R',   'Sportster 883 R',         'Sportster'),
  ('XL883HUG', 'Sportster 883 Hugger',    'Sportster'),
  ('XL1200',   'Sportster 1200',          'Sportster'),
  ('XL1200C',  'Sportster 1200 Custom',   'Sportster'),
  ('XL1200S',  'Sportster 1200 Sport',    'Sportster'),
  -- Touring Police + CVO (SEI) special editions
  ('FLHP',    'Police Road King',           'Touring'),
  ('FLHPI',   'Police Road King (EFI)',     'Touring'),
  ('FLHPEI',  'Police Road King (EFI)',     'Touring'),
  ('FLHTPI',  'Police Electra Glide (EFI)', 'Touring'),
  ('FLHRSEI', 'CVO Road King',              'Touring'),
  ('FLTRSEI', 'CVO Road Glide',             'Touring'),
  ('FLTRSEI2','CVO Road Glide',             'Touring')
on conflict (model_code, model_family) do nothing;
