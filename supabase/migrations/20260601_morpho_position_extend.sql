-- supabase/migrations/20260601_morpho_position_extend.sql
-- Étend la contrainte CHECK position de morpho_photos pour inclure 'relaxed' + 'contracted'.
-- Cause racine : les photos de bilan 'photo_relaxed'/'photo_contracted' violaient la CHECK,
-- faisant échouer l'upsert batch entier du sync (left/right inclus → jamais insérées).

alter table public.morpho_photos
  drop constraint if exists morpho_photos_position_check;

alter table public.morpho_photos
  add constraint morpho_photos_position_check
  check (position in (
    'front', 'back', 'left', 'right',
    'three_quarter_front_left', 'three_quarter_front_right',
    'relaxed', 'contracted'
  ));
