begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

create or replace function public.finalize_program_mesocycle_swap(
  p_program_id uuid,
  p_existing_week_ids uuid[],
  p_generated_week_ids uuid[],
  p_duration_weeks integer,
  p_completion_behavior text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_week_ids uuid[];
  generated_count integer;
  week_index integer;
begin
  if p_duration_weeks < 2 or p_duration_weeks > 12 then
    raise exception 'La durée du mésocycle doit être comprise entre 2 et 12 semaines';
  end if;

  if p_completion_behavior not in ('repeat', 'hold_last', 'stop') then
    raise exception 'Comportement de fin invalide';
  end if;

  if coalesce(array_length(p_generated_week_ids, 1), 0) <> p_duration_weeks then
    raise exception 'Le nombre de semaines générées ne correspond pas à la durée';
  end if;

  if p_existing_week_ids && p_generated_week_ids then
    raise exception 'Les semaines sources et générées doivent être distinctes';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_program_id::text));

  select coalesce(array_agg(id order by position), '{}'::uuid[])
  into current_week_ids
  from public.program_weeks
  where program_id = p_program_id
    and not (id = any(p_generated_week_ids));

  if current_week_ids is distinct from p_existing_week_ids then
    raise exception 'Le cycle a été modifié pendant la génération';
  end if;

  select count(*)
  into generated_count
  from public.program_weeks
  where program_id = p_program_id
    and id = any(p_generated_week_ids);

  if generated_count <> p_duration_weeks then
    raise exception 'Certaines semaines générées sont introuvables';
  end if;

  delete from public.program_weeks
  where program_id = p_program_id
    and id = any(p_existing_week_ids);

  for week_index in 1..p_duration_weeks loop
    update public.program_weeks
    set
      position = week_index - 1,
      label = 'Semaine ' || week_index
    where program_id = p_program_id
      and id = p_generated_week_ids[week_index];

    if not found then
      raise exception 'Impossible de repositionner la semaine %', week_index;
    end if;
  end loop;

  update public.programs
  set
    weeks = p_duration_weeks,
    completion_behavior = p_completion_behavior,
    updated_at = now()
  where id = p_program_id;

  if not found then
    raise exception 'Programme introuvable';
  end if;
end;
$$;

revoke all on function public.finalize_program_mesocycle_swap(uuid, uuid[], uuid[], integer, text)
  from public, anon, authenticated;
grant execute on function public.finalize_program_mesocycle_swap(uuid, uuid[], uuid[], integer, text)
  to service_role;

notify pgrst, 'reload schema';

commit;
