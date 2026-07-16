begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

alter table public.program_exercises
  drop constraint if exists program_exercises_rir_check,
  drop constraint if exists program_exercises_target_rir_check;

alter table public.coach_program_template_exercises
  drop constraint if exists coach_program_template_exercises_rir_check,
  drop constraint if exists coach_program_template_exercises_target_rir_check;

alter table public.program_exercises
  alter column rir type numeric(3,1) using rir::numeric(3,1),
  alter column target_rir type numeric(3,1) using target_rir::numeric(3,1);

alter table public.coach_program_template_exercises
  alter column rir type numeric(3,1) using rir::numeric(3,1),
  alter column target_rir type numeric(3,1) using target_rir::numeric(3,1);

alter table public.program_exercises
  add constraint program_exercises_rir_check
    check (rir is null or (rir between 0 and 10 and mod(rir * 10, 5) = 0)),
  add constraint program_exercises_target_rir_check
    check (target_rir is null or (target_rir between 0 and 10 and mod(target_rir * 10, 5) = 0));

alter table public.coach_program_template_exercises
  add constraint coach_program_template_exercises_rir_check
    check (rir is null or (rir between 0 and 10 and mod(rir * 10, 5) = 0)),
  add constraint coach_program_template_exercises_target_rir_check
    check (target_rir is null or (target_rir between 0 and 10 and mod(target_rir * 10, 5) = 0));

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'progression_events'
      and column_name = 'target_rir_values'
  ) then
    alter table public.progression_events
      add column if not exists target_rir_values_fractional numeric(3,1)[];

    update public.progression_events event
    set target_rir_values_fractional = (
      select array_agg(item.value::numeric(3,1) order by item.ordinality)
      from unnest(event.target_rir_values) with ordinality as item(value, ordinality)
    )
    where event.target_rir_values is not null;

    alter table public.progression_events
      drop column target_rir_values;
    alter table public.progression_events
      rename column target_rir_values_fractional to target_rir_values;
  else
    alter table public.progression_events
      add column target_rir_values numeric(3,1)[];
  end if;
end;
$$;

comment on column public.program_exercises.rir is
  'RIR ou RPE prescrit. Accepte les demi-paliers de 0 a 10.';
comment on column public.program_exercises.target_rir is
  'RIR ou RPE cible. Accepte les demi-paliers de 0 a 10.';
comment on column public.coach_program_template_exercises.rir is
  'RIR ou RPE prescrit. Accepte les demi-paliers de 0 a 10.';
comment on column public.coach_program_template_exercises.target_rir is
  'RIR ou RPE cible. Accepte les demi-paliers de 0 a 10.';
comment on column public.progression_events.target_rir_values is
  'RIR cibles utilises pendant l evaluation, par serie retenue. Accepte les demi-paliers.';

notify pgrst, 'reload schema';

commit;
