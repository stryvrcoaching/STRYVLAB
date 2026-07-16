CREATE TABLE IF NOT EXISTS coach_exercise_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'pattern', -- 'pattern' or 'circuit'
  exercises jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_exercise_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_exercise_patterns_own" ON coach_exercise_patterns
  FOR ALL USING (coach_id = auth.uid());
