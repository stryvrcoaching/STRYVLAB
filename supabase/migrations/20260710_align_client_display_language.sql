-- Keep the client profile schema aligned with the application contract.
-- The photo-log code falls back to client_preferences.language when this is absent,
-- but other client surfaces may use the profile preference directly.
ALTER TABLE public.coach_clients
  ADD COLUMN IF NOT EXISTS display_lang text;

ALTER TABLE public.coach_clients
  DROP CONSTRAINT IF EXISTS coach_clients_display_lang_check;

ALTER TABLE public.coach_clients
  ADD CONSTRAINT coach_clients_display_lang_check
  CHECK (display_lang IS NULL OR display_lang IN ('fr', 'en', 'es'));
