-- Migration: nutrition_weekly_reviews
-- Persists the result of the weekly intelligence engine for audit and history
-- Apply manually via Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS nutrition_weekly_reviews (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id             uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  week_start            date NOT NULL,                      -- ISO Monday of the analyzed week
  weight_avg_kg         numeric(5,2),
  weight_delta_kg       numeric(5,2),                       -- vs previous week avg
  waist_trend           text CHECK (waist_trend IN ('up', 'stable', 'down')),
  adherence_pct         numeric(5,2),                       -- 0.00 – 1.00
  avg_energy            numeric(4,2),                       -- 1-5
  avg_sleep_h           numeric(4,2),
  avg_stress            numeric(4,2),                       -- 1-5
  avg_hunger            numeric(4,2),                       -- 1-4
  perf_trend            text CHECK (perf_trend IN ('improving', 'stable', 'declining')),
  diagnosis             text NOT NULL CHECK (diagnosis IN (
    'optimal_recomp', 'behavioral', 'deficit_aggressive', 'surplus_real', 'insufficient_data'
  )),
  action                text NOT NULL CHECK (action IN (
    'no_change', 'adjust_carbs_up', 'adjust_carbs_down', 'focus_adherence', 'recovery'
  )),
  carb_adjustment_pct   smallint CHECK (carb_adjustment_pct BETWEEN -10 AND 10),
  guardrail_triggered   text CHECK (guardrail_triggered IN ('adherence_block', 'fatigue_block')),
  reasoning             text,
  raw_data              jsonb,                              -- full inputs for audit
  created_at            timestamptz DEFAULT now(),
  UNIQUE (client_id, week_start)
);

CREATE INDEX IF NOT EXISTS nutrition_weekly_reviews_client_week_idx
  ON nutrition_weekly_reviews (client_id, week_start DESC);

ALTER TABLE nutrition_weekly_reviews ENABLE ROW LEVEL SECURITY;

-- Coach: full CRUD on their clients
CREATE POLICY "coach_manage_weekly_reviews"
  ON nutrition_weekly_reviews
  FOR ALL
  USING (
    client_id IN (SELECT id FROM coach_clients WHERE coach_id = auth.uid())
  );

-- Client: read only own reviews
CREATE POLICY "client_read_own_weekly_reviews"
  ON nutrition_weekly_reviews
  FOR SELECT
  USING (
    client_id IN (SELECT id FROM coach_clients WHERE user_id = auth.uid())
  );
