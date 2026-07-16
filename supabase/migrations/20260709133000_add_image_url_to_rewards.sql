-- Add image_url to coach_rewards table
ALTER TABLE coach_rewards ADD COLUMN IF NOT EXISTS image_url TEXT;
