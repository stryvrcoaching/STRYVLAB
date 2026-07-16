-- Add icon_name to coach_rewards

ALTER TABLE coach_rewards ADD COLUMN IF NOT EXISTS icon_name TEXT;
