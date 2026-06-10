CREATE TABLE IF NOT EXISTS public.coach_template_exercise_alternatives (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id   uuid NOT NULL REFERENCES public.coach_program_template_exercises(id) ON DELETE CASCADE,
  name          text NOT NULL,
  notes         text,
  position      int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_ex_alternatives_exercise_id
  ON public.coach_template_exercise_alternatives (exercise_id, position);

ALTER TABLE public.coach_template_exercise_alternatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_manages_own_alternatives"
  ON public.coach_template_exercise_alternatives
  FOR ALL
  USING (
    exercise_id IN (
      SELECT cte.id
      FROM public.coach_program_template_exercises cte
      JOIN public.coach_program_template_sessions cts ON cts.id = cte.session_id
      JOIN public.coach_program_templates cpt ON cpt.id = cts.template_id
      WHERE cpt.coach_id = auth.uid()
    )
  );

CREATE POLICY "client_reads_alternatives"
  ON public.coach_template_exercise_alternatives
  FOR SELECT
  USING (true);
