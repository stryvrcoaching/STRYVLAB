-- ============================================================
-- SESSION LOGGER V2 — Améliorations
--
-- 1. program_exercises  — image_url + is_unilateral
-- 2. client_session_logs — exercise_notes (JSONB)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. program_exercises — image et flag unilatéral
-- ────────────────────────────────────────────────────────────

alter table public.program_exercises
  add column if not exists image_url text,
  add column if not exists is_unilateral boolean not null default false;

comment on column public.program_exercises.image_url is
  'URL image ou GIF de démonstration de l''exercice (catalogue ou upload coach)';

comment on column public.program_exercises.is_unilateral is
  'True = exercice unilatéral → le SessionLogger affiche deux sous-sets L et R par série';

-- ────────────────────────────────────────────────────────────
-- 2. client_session_logs — notes de ressenti par exercice
--
-- Stocké en JSONB : { "<exercise_id>": "texte libre" }
-- Permet d'ajouter des notes sans table supplémentaire,
-- et reste extensible (ajouter rating, emoji, etc. en Phase 2)
-- ────────────────────────────────────────────────────────────

alter table public.client_session_logs
  add column if not exists exercise_notes jsonb not null default '{}'::jsonb;

comment on column public.client_session_logs.exercise_notes is
  'Notes de ressenti client par exercice : { "<exercise_id>": "<texte>" }. Saisies dans le SessionLogger.';

-- ────────────────────────────────────────────────────────────
-- 3. client_set_logs — colonne side pour les exercices unilatéraux
-- ────────────────────────────────────────────────────────────

alter table public.client_set_logs
  add column if not exists side text
  check (side in ('left', 'right', 'bilateral'));

comment on column public.client_set_logs.side is
  'Côté du set : left / right pour les exercices unilatéraux, bilateral sinon (ou null = non renseigné)';
