-- Client push preferences: each category that can be sent by STRYVR is explicit.
ALTER TABLE public.client_preferences
  ADD COLUMN IF NOT EXISTS notif_checkin_reminder boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_hydration_reminder boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_coach_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_progress_updates boolean NOT NULL DEFAULT true;
