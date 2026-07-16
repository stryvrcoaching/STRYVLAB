ALTER TABLE public.nutrition_protocols
  ADD COLUMN IF NOT EXISTS cycle_sync_profile JSONB NOT NULL DEFAULT '{"mode":"standard","intensity_percent":100}'::jsonb;

ALTER TABLE public.nutrition_protocols
  DROP CONSTRAINT IF EXISTS nutrition_protocols_cycle_sync_profile_object;

ALTER TABLE public.nutrition_protocols
  ADD CONSTRAINT nutrition_protocols_cycle_sync_profile_object
  CHECK (jsonb_typeof(cycle_sync_profile) = 'object');
