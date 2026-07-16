alter table public.program_exercises
  add column if not exists created_by_client boolean not null default false,
  add column if not exists created_by_client_id uuid references public.coach_clients(id) on delete set null;

comment on column public.program_exercises.created_by_client is
  'True when the exercise was added from the client workout logger into an assigned coach programme session.';

comment on column public.program_exercises.created_by_client_id is
  'Client who added this exercise from the workout logger.';
