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
  ('FXD35',  'Dyna 35th Anniversary Super Glide', 'Dyna')
on conflict (model_code, model_family) do nothing;
