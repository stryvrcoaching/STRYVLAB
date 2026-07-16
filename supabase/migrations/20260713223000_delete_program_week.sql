begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

create or replace function public.delete_program_week_and_reorder(
  p_program_id uuid,
  p_week_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  week_count integer;
  ordered_week record;
  next_position integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext(p_program_id::text));

  select count(*)
  into week_count
  from public.program_weeks
  where program_id = p_program_id;

  if week_count <= 1 then
    raise exception 'La dernière semaine du cycle ne peut pas être supprimée';
  end if;

  perform 1
  from public.program_weeks
  where id = p_week_id
    and program_id = p_program_id;

  if not found then
    raise exception 'Semaine introuvable';
  end if;

  delete from public.program_weeks
  where id = p_week_id
    and program_id = p_program_id;

  for ordered_week in
    select id, position, label
    from public.program_weeks
    where program_id = p_program_id
    order by position, id
  loop
    if ordered_week.position <> next_position
      or ordered_week.label ~ '^Semaine [0-9]+$'
    then
      update public.program_weeks
      set
        position = next_position,
        label = case
          when ordered_week.label ~ '^Semaine [0-9]+$' then 'Semaine ' || (next_position + 1)
          else ordered_week.label
        end
      where id = ordered_week.id;
    end if;
    next_position := next_position + 1;
  end loop;

  update public.programs
  set updated_at = now()
  where id = p_program_id;

  if not found then
    raise exception 'Programme introuvable';
  end if;
end;
$$;

revoke all on function public.delete_program_week_and_reorder(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_program_week_and_reorder(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';

commit;
