-- Smart Fit: coach intent per broad muscle group.
-- Example: {"pectoraux":"priority","dos":"progression"}
alter table public.coach_program_templates
  add column if not exists volume_focus jsonb not null default '{}'::jsonb;

alter table public.programs
  add column if not exists volume_focus jsonb not null default '{}'::jsonb;

comment on column public.coach_program_templates.volume_focus is
  'Smart Fit objectives by broad muscle group: priority, progression, maintenance, off.';

comment on column public.programs.volume_focus is
  'Smart Fit objectives by broad muscle group: priority, progression, maintenance, off.';
