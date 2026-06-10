-- 20260527_cycle_sync_enabled.sql
-- Apply manually via Supabase Dashboard SQL Editor

-- 1. Coach can activate cycle sync per protocol
ALTER TABLE nutrition_protocols
  ADD COLUMN IF NOT EXISTS cycle_sync_enabled BOOLEAN NOT NULL DEFAULT false;

-- 2. Log cycle phase at check-in time for historical analytics
ALTER TABLE client_daily_checkins
  ADD COLUMN IF NOT EXISTS cycle_phase TEXT CHECK (
    cycle_phase IN ('follicular', 'ovulatory', 'luteal', 'menstrual')
  ),
  ADD COLUMN IF NOT EXISTS cycle_day INT CHECK (cycle_day >= 1 AND cycle_day <= 35);
