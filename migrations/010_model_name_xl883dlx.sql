-- Name for the 1991-1996 Sportster code from the sportster4 batch.
-- Safe to re-run.

insert into model_name (model_code, name, model_family) values
  ('XL883DLX', 'Sportster 883 Deluxe', 'Sportster')
on conflict (model_code, model_family) do nothing;
