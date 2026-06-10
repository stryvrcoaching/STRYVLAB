-- Migration: Validate and fix weekly_frequency bounds (1-7 days/week)
-- Date: 2026-04-26
-- Purpose: Clean up bad weekly_frequency values in coach_clients table

-- Set invalid values (not 1-7) to NULL
UPDATE coach_clients
SET weekly_frequency = NULL
WHERE weekly_frequency IS NOT NULL
  AND (weekly_frequency < 1 OR weekly_frequency > 7);

-- Add constraint to prevent bad values in the future
ALTER TABLE coach_clients
ADD CONSTRAINT check_weekly_frequency_bounds
CHECK (weekly_frequency IS NULL OR (weekly_frequency >= 1 AND weekly_frequency <= 7));

-- Document the fix
COMMENT ON CONSTRAINT check_weekly_frequency_bounds ON coach_clients IS
  'Ensures weekly_frequency is between 1-7 days per week, or NULL';
