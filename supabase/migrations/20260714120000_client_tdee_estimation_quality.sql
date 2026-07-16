-- Client-level TDEE quality and readiness. Protocols consume snapshots; they do not own this state.

alter table public.client_tdee_state
  add column if not exists estimation_status text not null default 'collecting'
    check (estimation_status in ('collecting', 'observing', 'actionable')),
  add column if not exists data_quality_score integer
    check (data_quality_score between 0 and 100),
  add column if not exists data_quality_reasons jsonb not null default '[]'::jsonb;

alter table public.client_tdee_state
  add column if not exists auto_enabled boolean not null default false;

alter table public.nutrition_tdee_history
  add column if not exists estimation_status text
    check (estimation_status in ('collecting', 'observing', 'actionable')),
  add column if not exists data_quality_score integer
    check (data_quality_score between 0 and 100),
  add column if not exists data_quality_reasons jsonb not null default '[]'::jsonb;

update public.client_tdee_state
set estimation_status = case
  when source = 'weight_delta' and coalesce(window_days, 0) >= 14
    and coalesce(weight_samples, 0) >= 8 and coalesce(tracked_days, 0) >= 10
    then 'actionable'
  when source = 'weight_delta' and coalesce(window_days, 0) >= 14
    and coalesce(weight_samples, 0) >= 4 and coalesce(tracked_days, 0) >= 5
    then 'observing'
  else 'collecting'
end
where estimation_status = 'collecting';

insert into public.client_tdee_state (client_id, auto_enabled)
select distinct client_id, true
from public.nutrition_protocols
where status = 'shared' and tdee_auto_enabled = true
on conflict (client_id) do update
set auto_enabled = excluded.auto_enabled;
