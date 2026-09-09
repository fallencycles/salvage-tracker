-- Parse noise: a few "model codes" in the fitment data are fragments of a
-- description or colour name, not real Harley model designations.
--   VR     — 8 rows, all from touring_2000_fltrsei_parts.json; descriptions are
--            truncated mid-word ("SIDE COVER, left (vivid"). "VR" is a fragment
--            of "vivid" / a colour code, not a model.
--   FXDRS  — 2 rows, both on generic hardware (washer 6110, screw 942); no such
--            Harley code (FXDR exists; "FXDR S" got mashed into one token).
-- Remove them from both the raw fitment table and the year-range rollup. Safe to
-- re-run. The importer now also filters this class of junk on the way in
-- (see scripts/import_catalog_batch.mjs).

delete from catalog_part_fitment    where model_code in ('VR', 'FXDRS');
delete from mv_part_fitment_ranges  where model_code in ('VR', 'FXDRS');
