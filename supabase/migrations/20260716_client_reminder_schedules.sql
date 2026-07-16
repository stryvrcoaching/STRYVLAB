-- Personal reminder schedules for the STRYVR client application.
ALTER TABLE public.client_preferences
  ADD COLUMN IF NOT EXISTS training_reminder_times text[] NOT NULL DEFAULT ARRAY['08:00', '18:00'],
  ADD COLUMN IF NOT EXISTS hydration_reminder_first_time text NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS hydration_reminder_count smallint NOT NULL DEFAULT 3
    CHECK (hydration_reminder_count BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS notif_meal_reminder boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_protein_reminder boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS meal_reminder_breakfast_time text NOT NULL DEFAULT '10:30',
  ADD COLUMN IF NOT EXISTS meal_reminder_lunch_time text NOT NULL DEFAULT '14:30',
  ADD COLUMN IF NOT EXISTS protein_reminder_time text NOT NULL DEFAULT '20:00';

ALTER TABLE public.client_preferences
  DROP CONSTRAINT IF EXISTS client_preferences_training_reminder_times_count;

ALTER TABLE public.client_preferences
  ADD CONSTRAINT client_preferences_training_reminder_times_count
  CHECK (cardinality(training_reminder_times) BETWEEN 1 AND 2);
