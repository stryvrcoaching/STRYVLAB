-- Migration: program_adjustment_proposals
-- Phase 3 Performance Feedback Loops — coach review queue for auto-generated program adjustments

CREATE TABLE IF NOT EXISTS public.program_adjustment_proposals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES public.coach_clients(id) ON DELETE CASCADE,
  exercise_id       UUID REFERENCES public.program_exercises(id) ON DELETE SET NULL,
  program_id        UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('increase_volume','decrease_volume','increase_weight','swap_exercise','add_rest_day')),
  reason            TEXT NOT NULL,
  proposed_value    JSONB NOT NULL DEFAULT '{}',
  current_value     JSONB NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  coach_notes       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_proposals_client_status ON public.program_adjustment_proposals(client_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_program ON public.program_adjustment_proposals(program_id);

ALTER TABLE public.program_adjustment_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_manage_proposals"
  ON public.program_adjustment_proposals
  FOR ALL
  USING (client_id IN (SELECT id FROM public.coach_clients WHERE coach_id = auth.uid()));
