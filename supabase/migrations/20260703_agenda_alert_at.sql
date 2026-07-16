alter table public.agenda_events
  add column if not exists alert_at timestamptz;

create index if not exists idx_agenda_events_alert_at
  on public.agenda_events (coach_id, alert_at)
  where alert_at is not null;
