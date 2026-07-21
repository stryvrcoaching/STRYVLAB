alter table public.program_exercises
  add column if not exists created_by_client boolean not null default false,
  add column if not exists created_by_client_id uuid references public.coach_clients(id) on delete set null;

notify pgrst, 'reload schema';
