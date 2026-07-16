-- ─────────────────────────────────────────────────────────────────────────────
-- coach_ics_tokens
-- 2026-07-17
-- Table des jetons ICS pour l'abonnement universel iCal/Apple Calendar
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coach_ics_tokens (
  coach_id   uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token      uuid        NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_ics_tokens ENABLE ROW LEVEL SECURITY;

-- Le coach peut lire et supprimer son propre token (la régénération passe par le service role)
CREATE POLICY "coach manages own ics token"
  ON public.coach_ics_tokens FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Index sur le token (recherche par token sans auth)
CREATE UNIQUE INDEX IF NOT EXISTS coach_ics_tokens_token_idx
  ON public.coach_ics_tokens (token);
