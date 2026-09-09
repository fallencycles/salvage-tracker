-- "1998.5 XL883C SPORTSTER" is a real catalog page (a supplement listing the
-- parts specific to the 1998½ XL883C mid-year model) but the page title reads
-- like a model header, so it surfaced as its own "component" under Other. 9 of
-- its 23 parts appear nowhere else, so it can't just be deleted. Rename it to a
-- clean, self-describing label that also lands it in "Hardware & Misc".
-- Safe to re-run.

update catalog_part
   set component = 'XL883C SPORTSTER 1998.5, MISCELLANEOUS'
 where component = '1998.5 XL883C SPORTSTER';

update catalog_component_image
   set component = 'XL883C SPORTSTER 1998.5, MISCELLANEOUS'
 where component = '1998.5 XL883C SPORTSTER';
