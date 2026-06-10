-- Chat/Check-in coherence — Plan 3 schema
-- 1) Per-client "coaching freedom" gating AI lifestyle tips (D11): none | safe | extended (default safe)
-- 2) Extend coach_notifications.category with advice alert categories (D10/D12)

ALTER TABLE public.coach_ai_settings_per_client
  ADD COLUMN IF NOT EXISTS coaching_freedom text NOT NULL DEFAULT 'safe'
  CHECK (coaching_freedom IN ('none', 'safe', 'extended'));

ALTER TABLE public.coach_notifications
  DROP CONSTRAINT IF EXISTS coach_notifications_category_check;

ALTER TABLE public.coach_notifications
  ADD CONSTRAINT coach_notifications_category_check
  CHECK (category IN (
    'safety', 'out_of_scope', 'pattern_inquiry', 'engagement', 'weight_off_track',
    'program_signal', 'nutrition_trend', 'recovery_flag'
  ));
