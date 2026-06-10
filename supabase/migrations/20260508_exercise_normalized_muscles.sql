-- Add normalized muscle columns to all exercise tables
-- These are the source of truth for muscle targeting
-- Non-nullable after migration

-- Coach template exercises
ALTER TABLE coach_program_template_exercises
ADD COLUMN primary_muscles_normalized text[] NOT NULL DEFAULT '{}',
ADD COLUMN secondary_muscles_normalized text[] NOT NULL DEFAULT '{}';

-- Program exercises (instances assigned to clients)
ALTER TABLE program_exercises
ADD COLUMN primary_muscles_normalized text[] NOT NULL DEFAULT '{}',
ADD COLUMN secondary_muscles_normalized text[] NOT NULL DEFAULT '{}';

-- Coach custom exercises
ALTER TABLE coach_custom_exercises
ADD COLUMN primary_muscles_normalized text[] NOT NULL DEFAULT '{}',
ADD COLUMN secondary_muscles_normalized text[] NOT NULL DEFAULT '{}';

-- Indexes for faster queries
CREATE INDEX idx_coach_template_ex_primary_muscles
  ON coach_program_template_exercises USING GIN (primary_muscles_normalized);

CREATE INDEX idx_coach_template_ex_secondary_muscles
  ON coach_program_template_exercises USING GIN (secondary_muscles_normalized);

CREATE INDEX idx_program_ex_primary_muscles
  ON program_exercises USING GIN (primary_muscles_normalized);

CREATE INDEX idx_program_ex_secondary_muscles
  ON program_exercises USING GIN (secondary_muscles_normalized);

CREATE INDEX idx_coach_custom_ex_primary_muscles
  ON coach_custom_exercises USING GIN (primary_muscles_normalized);

-- Trigger to sync coach_custom_exercises muscles to normalized
CREATE OR REPLACE FUNCTION sync_custom_exercise_muscles()
RETURNS TRIGGER AS $$
BEGIN
  -- If muscles array is updated, normalize it
  -- For now, just copy (app layer will validate)
  IF NEW.muscles IS NOT NULL AND array_length(NEW.muscles, 1) > 0 THEN
    NEW.primary_muscles_normalized := NEW.muscles;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER custom_exercise_sync_muscles
BEFORE INSERT OR UPDATE ON coach_custom_exercises
FOR EACH ROW
EXECUTE FUNCTION sync_custom_exercise_muscles();
