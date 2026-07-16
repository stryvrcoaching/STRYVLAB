ALTER TABLE public.coach_notifications
  DROP CONSTRAINT IF EXISTS coach_notifications_category_check;

ALTER TABLE public.coach_notifications
  ADD CONSTRAINT coach_notifications_category_check
  CHECK (category IN (
    'safety',
    'out_of_scope',
    'pattern_inquiry',
    'engagement',
    'weight_off_track',
    'program_signal',
    'nutrition_trend',
    'recovery_flag',
    'assessment',
    'training',
    'admin'
  ));
