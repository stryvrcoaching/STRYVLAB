/* Migration: Add morning resting heart rate to client_daily_checkins */
ALTER TABLE public.client_daily_checkins
  ADD COLUMN IF NOT EXISTS rhr_morning integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_daily_checkins_rhr_morning_range'
  ) THEN
    ALTER TABLE public.client_daily_checkins
      ADD CONSTRAINT client_daily_checkins_rhr_morning_range
      CHECK (rhr_morning IS NULL OR rhr_morning BETWEEN 30 AND 200);
  END IF;
END $$;
