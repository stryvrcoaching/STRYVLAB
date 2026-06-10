-- ============================================================
-- RLS Hardening — Security audit 2026-04-04
--
-- Gaps addressed (policies that were missing from creation migrations):
--   1. coach_program_templates — explicit INSERT with check (system template protection)
--   2. coach_program_template_sessions/exercises — explicit INSERT with check
--   3. programs — explicit INSERT with check
--   4. client_session_logs / client_set_logs — explicit INSERT with check
--
-- Already exists (confirmed in creation migrations, NOT duplicated here):
--   - client_sees_own_submissions (assessment_system.sql)
--   - coach_own_programs, client_sees_own_programs (programs.sql)
--   - coach_own_template_sessions, coach_own_template_exercises (program_templates.sql)
--   - All CRM policies (crm_system.sql)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. coach_program_templates — explicit INSERT with check
--    Prevents a coach from creating a system template or one
--    with a null coach_id via the API.
-- ────────────────────────────────────────────────────────────
create policy "coach_insert_own_template"
  on public.coach_program_templates for insert
  with check (
    auth.uid() = coach_id
    and coach_id is not null
    and is_system = false
  );

-- ────────────────────────────────────────────────────────────
-- 2. coach_program_template_sessions — explicit INSERT with check
-- ────────────────────────────────────────────────────────────
create policy "coach_insert_template_session"
  on public.coach_program_template_sessions for insert
  with check (
    exists (
      select 1 from public.coach_program_templates t
      where t.id = template_id
        and t.coach_id = auth.uid()
        and t.is_system = false
    )
  );

-- ────────────────────────────────────────────────────────────
-- 3. coach_program_template_exercises — explicit INSERT with check
-- ────────────────────────────────────────────────────────────
create policy "coach_insert_template_exercise"
  on public.coach_program_template_exercises for insert
  with check (
    exists (
      select 1 from public.coach_program_template_sessions s
      join public.coach_program_templates t on t.id = s.template_id
      where s.id = session_id
        and t.coach_id = auth.uid()
        and t.is_system = false
    )
  );

-- ────────────────────────────────────────────────────────────
-- 4. programs — explicit INSERT with check
-- ────────────────────────────────────────────────────────────
create policy "coach_insert_program"
  on public.programs for insert
  with check (auth.uid() = coach_id);

-- ────────────────────────────────────────────────────────────
-- 5. client_session_logs — explicit INSERT with check
-- ────────────────────────────────────────────────────────────
create policy "client_insert_own_session_log"
  on public.client_session_logs for insert
  with check (
    exists (
      select 1 from public.coach_clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 6. client_set_logs — explicit INSERT with check
-- ────────────────────────────────────────────────────────────
create policy "client_insert_own_set_log"
  on public.client_set_logs for insert
  with check (
    exists (
      select 1 from public.client_session_logs sl
      join public.coach_clients c on c.id = sl.client_id
      where sl.id = session_log_id and c.user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 7. Idempotent RLS enable on all critical tables
--    (safe to run even if already enabled)
-- ────────────────────────────────────────────────────────────
alter table public.coach_clients              enable row level security;
alter table public.assessment_templates       enable row level security;
alter table public.assessment_submissions     enable row level security;
alter table public.assessment_responses       enable row level security;
alter table public.client_access_tokens       enable row level security;
alter table public.client_notifications       enable row level security;
alter table public.client_preferences         enable row level security;
alter table public.client_session_logs        enable row level security;
alter table public.client_set_logs            enable row level security;
alter table public.coach_program_templates    enable row level security;
alter table public.coach_program_template_sessions enable row level security;
alter table public.coach_program_template_exercises enable row level security;
alter table public.programs                   enable row level security;
alter table public.program_sessions           enable row level security;
alter table public.program_exercises          enable row level security;
alter table public.coach_formulas             enable row level security;
alter table public.client_subscriptions       enable row level security;
alter table public.subscription_payments      enable row level security;
alter table public.coach_tags                 enable row level security;
alter table public.client_tags                enable row level security;
