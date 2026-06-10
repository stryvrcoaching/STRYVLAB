CREATE TABLE IF NOT EXISTS coach_custom_exercises (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  slug                 text NOT NULL,
  movement_pattern     text,
  is_compound          boolean NOT NULL DEFAULT false,
  equipment            text[] NOT NULL DEFAULT '{}',
  muscles              text[] NOT NULL DEFAULT '{}',
  muscle_group         text,
  stimulus_coefficient numeric(4,2) NOT NULL DEFAULT 0.60,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coach_id, slug)
);

ALTER TABLE coach_custom_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_custom_exercises_own" ON coach_custom_exercises
  FOR ALL USING (coach_id = auth.uid());
