-- supabase/migrations/20260418_exercise_group_id.sql
ALTER TABLE coach_program_template_exercises
  ADD COLUMN IF NOT EXISTS group_id text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_template_exercises_group_id
  ON coach_program_template_exercises (session_id, group_id)
  WHERE group_id IS NOT NULL;
