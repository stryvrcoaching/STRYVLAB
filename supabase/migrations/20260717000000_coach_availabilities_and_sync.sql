-- ─────────────────────────────────────────────────────────────────────────────
-- coach_availabilities_and_sync
-- 2026-07-17
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Table des disponibilités hebdomadaires des coachs ──────────────────────

CREATE TABLE IF NOT EXISTS public.coach_availabilities (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week  int         NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1 = Lundi, 7 = Dimanche
  start_time   time        NOT NULL,
  end_time     time        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS coach_availabilities_coach_day_idx
  ON public.coach_availabilities (coach_id, day_of_week);

ALTER TABLE public.coach_availabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach manages own availabilities"
  ON public.coach_availabilities FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "client reads coach availabilities"
  ON public.coach_availabilities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_clients cc
      WHERE cc.coach_id = coach_availabilities.coach_id
        AND cc.user_id = auth.uid()
    )
  );

-- ── 2. Table de stockage des jetons OAuth Calendriers ───────────────────────

CREATE TABLE IF NOT EXISTS public.coach_calendar_tokens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      text        NOT NULL CHECK (provider IN ('google', 'outlook')),
  access_token  text        NOT NULL,
  refresh_token text,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, provider)
);

ALTER TABLE public.coach_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach manages own calendar tokens"
  ON public.coach_calendar_tokens FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- ── 3. Ajout des colonnes d'identifiants d'événements distants ────────────────

ALTER TABLE public.coaching_appointments
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS outlook_event_id text;
