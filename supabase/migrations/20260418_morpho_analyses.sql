-- ============================================================
-- morpho_analyses table — MorphoPro Bridge (Phase 0)
-- Stores versioned morphological analysis for each client
-- ============================================================

CREATE TABLE IF NOT EXISTS public.morpho_analyses (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES public.coach_clients(id) ON DELETE CASCADE,
  assessment_submission_id UUID REFERENCES public.assessment_submissions(id) ON DELETE SET NULL,

  -- Timestamps
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  analysis_date           DATE NOT NULL,

  -- Analysis payload (from OpenAI Vision API)
  raw_payload             JSONB,              -- Complete OpenAI response (unprocessed)
  body_composition        JSONB,              -- Parsed metrics: body_fat_pct, lean_mass_kg, etc.
  dimensions              JSONB,              -- Measurements: waist_cm, hip_cm, chest_cm, etc.
  asymmetries             JSONB,              -- Asymmetry detection: side:deviation_pct
  stimulus_adjustments    JSONB,              -- Morpho-derived stimulus modifiers per pattern

  -- Job tracking
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'completed', 'failed')),
  job_id                  TEXT,               -- n8n job ID for async tracking
  error_message           TEXT,               -- Error details if status = 'failed'
  analyzed_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT unique_submission_analysis UNIQUE(assessment_submission_id, analysis_date)
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_morpho_analyses_client_date
  ON public.morpho_analyses(client_id, analysis_date DESC);

CREATE INDEX IF NOT EXISTS idx_morpho_analyses_client_latest
  ON public.morpho_analyses(client_id) WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_morpho_analyses_status
  ON public.morpho_analyses(status);

-- Updated_at trigger
DROP TRIGGER IF EXISTS morpho_analyses_updated_at ON public.morpho_analyses;
CREATE TRIGGER morpho_analyses_updated_at
  BEFORE UPDATE ON public.morpho_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.morpho_analyses ENABLE ROW LEVEL SECURITY;

-- Coach can read/write own client morpho
CREATE POLICY "coach_read_own_client_morpho"
  ON public.morpho_analyses
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.coach_clients WHERE coach_id = auth.uid()
    )
  );

CREATE POLICY "coach_create_own_client_morpho"
  ON public.morpho_analyses
  FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.coach_clients WHERE coach_id = auth.uid()
    )
  );

CREATE POLICY "coach_update_own_client_morpho"
  ON public.morpho_analyses
  FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM public.coach_clients WHERE coach_id = auth.uid()
    )
  );

-- Client can read own morpho
CREATE POLICY "client_read_own_morpho"
  ON public.morpho_analyses
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.coach_clients WHERE user_id = auth.uid()
    )
  );
