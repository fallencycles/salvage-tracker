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

-- Dyna friendly names (1991-2000). Editable.
insert into model_name (model_code, name, model_family) values
  ('FXD',   'Dyna Super Glide',        'Dyna'),
  ('FXDB',  'Dyna Sturgis',            'Dyna'),
  ('FXDC',  'Dyna Daytona',            'Dyna'),
  ('FXDL',  'Dyna Low Rider',          'Dyna'),
  ('FXDS',  'Dyna Convertible',        'Dyna'),
  ('FXDWG', 'Dyna Wide Glide',         'Dyna'),
  ('FXDX',  'Dyna Super Glide Sport',  'Dyna')
on conflict (model_code, model_family) do nothing;
