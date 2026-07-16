-- Coach-facing inbox preferences. Critical safety alerts are intentionally not
-- represented here: they remain visible regardless of personal preferences.
ALTER TABLE public.coach_profiles
  ADD COLUMN IF NOT EXISTS notif_inbox_assessments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_inbox_training boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_inbox_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_inbox_checkins boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_inbox_nutrition boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_inbox_health_progress boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_inbox_administrative boolean NOT NULL DEFAULT true;
