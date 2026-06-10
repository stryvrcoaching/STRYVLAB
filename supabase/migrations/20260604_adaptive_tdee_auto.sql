-- 20260604_adaptive_tdee_auto.sql
-- 1. Add missing confidence columns to nutrition_tdee_history
-- 2. Add tdee_auto_enabled flag to nutrition_protocols

ALTER TABLE nutrition_tdee_history
  ADD COLUMN IF NOT EXISTS confidence        text    CHECK (confidence IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS confidence_score  integer CHECK (confidence_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS confidence_reasons jsonb   DEFAULT '[]'::jsonb;

ALTER TABLE nutrition_protocols
  ADD COLUMN IF NOT EXISTS tdee_auto_enabled boolean NOT NULL DEFAULT false;
