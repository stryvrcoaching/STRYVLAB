-- Evening check-in: daily step count
ALTER TABLE client_daily_checkins
  ADD COLUMN IF NOT EXISTS daily_steps integer CHECK (daily_steps >= 0 AND daily_steps <= 200000);
