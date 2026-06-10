-- supabase/migrations/20260529_morphopro_v2.sql
-- MorphoPro v2: biomech profile columns + evolution table

-- 1. Extend morpho_analyses
ALTER TABLE public.morpho_analyses
  ADD COLUMN IF NOT EXISTS biomech_profile JSONB,
  ADD COLUMN IF NOT EXISTS exercise_recommendations JSONB,
  ADD COLUMN IF NOT EXISTS prompt_version TEXT DEFAULT 'v1';

-- Backfill existing rows as v1
UPDATE public.morpho_analyses SET prompt_version = 'v1' WHERE prompt_version IS NULL;

-- 2. Evolution tracking table
CREATE TABLE IF NOT EXISTS public.morpho_evolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.coach_clients(id) ON DELETE CASCADE,
  previous_analysis_id UUID NOT NULL REFERENCES public.morpho_analyses(id),
  current_analysis_id UUID NOT NULL REFERENCES public.morpho_analyses(id),
  report JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(previous_analysis_id, current_analysis_id)
);

CREATE INDEX IF NOT EXISTS idx_morpho_evolutions_client
  ON public.morpho_evolutions(client_id, created_at DESC);

-- 3. RLS for morpho_evolutions
ALTER TABLE public.morpho_evolutions ENABLE ROW LEVEL SECURITY;

-- Coach can read/write evolutions for their clients
DROP POLICY IF EXISTS "coach_own_evolutions" ON public.morpho_evolutions;
CREATE POLICY "coach_own_evolutions" ON public.morpho_evolutions
  FOR ALL
  USING (
    client_id IN (
      SELECT id FROM public.coach_clients WHERE coach_id = auth.uid()
    )
  );
