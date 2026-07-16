create table if not exists public.nutrition_parse_feedback (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  meal_id uuid references public.nutrition_meals(id) on delete set null,
  source text not null,
  transcript text not null,
  meal_type text,
  parsed_payload jsonb not null default '{}'::jsonb,
  corrected_payload jsonb not null default '{}'::jsonb,
  notes text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nutrition_parse_feedback
  add constraint nutrition_parse_feedback_source_check
    check (source in ('voice', 'text'));

alter table public.nutrition_parse_feedback
  add constraint nutrition_parse_feedback_status_check
    check (status in ('pending', 'reviewed', 'exported'));

alter table public.nutrition_parse_feedback
  add constraint nutrition_parse_feedback_meal_type_check
    check (meal_type is null or meal_type in ('breakfast', 'lunch', 'dinner', 'snack'));

create index if not exists nutrition_parse_feedback_client_id_idx
  on public.nutrition_parse_feedback (client_id, created_at desc);

create index if not exists nutrition_parse_feedback_meal_id_idx
  on public.nutrition_parse_feedback (meal_id);

alter table public.nutrition_parse_feedback enable row level security;

drop policy if exists "nutrition_parse_feedback_client_own" on public.nutrition_parse_feedback;
create policy "nutrition_parse_feedback_client_own"
  on public.nutrition_parse_feedback for all
  using (
    exists (
      select 1
      from public.coach_clients c
      where c.id = public.nutrition_parse_feedback.client_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.coach_clients c
      where c.id = public.nutrition_parse_feedback.client_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "nutrition_parse_feedback_coach_select_owned" on public.nutrition_parse_feedback;
create policy "nutrition_parse_feedback_coach_select_owned"
  on public.nutrition_parse_feedback for select
  using (
    exists (
      select 1
      from public.coach_clients c
      where c.id = public.nutrition_parse_feedback.client_id
        and c.coach_id = auth.uid()
    )
  );

create table if not exists public.nutrition_parse_eval_cases (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  transcript text not null,
  expected_payload jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nutrition_parse_eval_cases
  add constraint nutrition_parse_eval_cases_source_check
    check (source in ('voice', 'text'));

create index if not exists nutrition_parse_eval_cases_source_idx
  on public.nutrition_parse_eval_cases (source, is_active, created_at desc);

alter table public.nutrition_parse_eval_cases enable row level security;

drop policy if exists "nutrition_parse_eval_cases_select_authenticated" on public.nutrition_parse_eval_cases;
create policy "nutrition_parse_eval_cases_select_authenticated"
  on public.nutrition_parse_eval_cases for select
  using (auth.uid() is not null);

drop policy if exists "nutrition_parse_eval_cases_insert_authenticated" on public.nutrition_parse_eval_cases;
create policy "nutrition_parse_eval_cases_insert_authenticated"
  on public.nutrition_parse_eval_cases for insert
  with check (auth.uid() is not null);

drop policy if exists "nutrition_parse_eval_cases_update_authenticated" on public.nutrition_parse_eval_cases;
create policy "nutrition_parse_eval_cases_update_authenticated"
  on public.nutrition_parse_eval_cases for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
