ALTER TABLE public.client_photo_meal_log_photos
  DROP CONSTRAINT IF EXISTS client_photo_meal_log_photos_kind_check;

ALTER TABLE public.client_photo_meal_log_photos
  ADD CONSTRAINT client_photo_meal_log_photos_kind_check
  CHECK (kind IN ('context', 'top', 'side', 'scale_zoom', 'leftovers'));
