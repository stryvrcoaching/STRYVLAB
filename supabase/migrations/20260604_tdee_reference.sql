-- 20260604_tdee_reference.sql
-- Store the coach's TDEE reference and deficit/surplus at protocol creation time.
-- This allows apply-adaptive-tdee to rescale correctly relative to the original
-- TDEE the coach used, not the absolute calories of day 1 (which already include
-- deficit/surplus adjustments).

ALTER TABLE nutrition_protocols
  ADD COLUMN IF NOT EXISTS tdee_reference integer,         -- TDEE used by coach when building the protocol
  ADD COLUMN IF NOT EXISTS deficit_surplus_pct numeric(5,2); -- negative = deficit, positive = surplus (e.g. -12.5, +8.0)
