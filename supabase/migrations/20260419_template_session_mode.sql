-- supabase/migrations/20260419_template_session_mode.sql
alter table public.coach_program_templates
  add column if not exists session_mode text not null default 'day'
  check (session_mode in ('day', 'cycle'));
