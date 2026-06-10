-- ============================================================
-- Double Progression — colonnes sur coach_program_template_exercises
--
-- La migration 20260405_double_progression.sql ajoutait ces colonnes
-- sur program_exercises (programmes assignés).
-- Cette migration les ajoute sur coach_program_template_exercises
-- (les templates — source pour le seed de progression).
-- ============================================================

alter table public.coach_program_template_exercises
  add column if not exists rep_min int check (rep_min >= 1),
  add column if not exists rep_max int check (rep_max >= 1),
  add column if not exists target_rir int check (target_rir between 0 and 5),
  add column if not exists weight_increment_kg numeric(4,2) not null default 2.5
    check (weight_increment_kg > 0);

comment on column public.coach_program_template_exercises.rep_min is
  'Borne basse de la plage de reps pour la double progression';
comment on column public.coach_program_template_exercises.rep_max is
  'Borne haute — atteindre rep_max sur toutes les séries déclenche la surcharge';
comment on column public.coach_program_template_exercises.target_rir is
  'RIR cible prescrit (0=échec, 2=conservateur). Copié dans program_exercises à l''assignation.';
comment on column public.coach_program_template_exercises.weight_increment_kg is
  'Incrément de charge en kg lors du trigger (défaut 2.5kg)';
