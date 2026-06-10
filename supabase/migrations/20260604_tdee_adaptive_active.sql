-- When true, the coach has chosen to use tdee_adaptive as the TDEE source
-- for all macro calculations in Nutrition Studio instead of the formula estimate.
ALTER TABLE nutrition_protocols
  ADD COLUMN IF NOT EXISTS tdee_adaptive_active boolean NOT NULL DEFAULT false;
