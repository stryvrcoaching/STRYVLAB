-- Enrich progression audit events with stable exercise identity and evaluated set context.

alter table public.progression_events
  add column if not exists exercise_name text,
  add column if not exists exercise_key text,
  add column if not exists eligible_sets_count int,
  add column if not exists set_types text[],
  add column if not exists target_rir_values int[],
  add column if not exists rep_max_values int[];

create index if not exists progression_events_exercise_key_idx
  on public.progression_events(exercise_key);

comment on column public.progression_events.exercise_name is
  'Nom canonique de l exercice au moment de l evaluation.';

comment on column public.progression_events.exercise_key is
  'Cle canonique stable utilisee pour regrouper historique et alertes.';

comment on column public.progression_events.eligible_sets_count is
  'Nombre de series eligibles a la progression apres exclusion des warmups/cooldowns.';

comment on column public.progression_events.set_types is
  'Types de series evaluees, dans l ordre des series retenues.';

comment on column public.progression_events.target_rir_values is
  'RIR cibles utilises pendant l evaluation, par serie retenue.';

comment on column public.progression_events.rep_max_values is
  'Rep max utilises pendant l evaluation, par serie retenue.';
