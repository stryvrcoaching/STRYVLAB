-- ============================================================
-- CLIENT USER LINK — Phase 2
-- Ajoute user_id sur coach_clients pour lier un client à son
-- compte Supabase Auth. Nullable : le coach peut créer un profil
-- avant que le client ait un compte.
-- ============================================================

alter table public.coach_clients
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists coach_clients_user_id_idx
  on public.coach_clients(user_id)
  where user_id is not null;

-- ============================================================
-- RLS — Le client authentifié voit son propre profil
-- ============================================================
create policy "client_sees_own_profile"
  on public.coach_clients
  for select using (auth.uid() = user_id);

-- ============================================================
-- RLS — Le client voit ses propres soumissions de bilan
-- ============================================================
create policy "client_sees_own_submissions"
  on public.assessment_submissions
  for select using (
    exists (
      select 1 from public.coach_clients c
      where c.id = assessment_submissions.client_id
        and c.user_id = auth.uid()
    )
  );

-- ============================================================
-- RLS — Le client voit ses propres réponses
-- ============================================================
create policy "client_sees_own_responses"
  on public.assessment_responses
  for select using (
    exists (
      select 1 from public.assessment_submissions s
      join public.coach_clients c on c.id = s.client_id
      where s.id = assessment_responses.submission_id
        and c.user_id = auth.uid()
    )
  );
