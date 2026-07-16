INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'nutrition-photo-logs',
  'nutrition-photo-logs',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

UPDATE public.client_photo_meal_log_photos
SET signed_url = NULL
WHERE signed_url IS NOT NULL;

DROP POLICY IF EXISTS "No public read on nutrition-photo-logs" ON storage.objects;
CREATE POLICY "No public read on nutrition-photo-logs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'nutrition-photo-logs' AND false);

DROP POLICY IF EXISTS "No direct insert on nutrition-photo-logs" ON storage.objects;
CREATE POLICY "No direct insert on nutrition-photo-logs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'nutrition-photo-logs' AND false);

DROP POLICY IF EXISTS "No direct update on nutrition-photo-logs" ON storage.objects;
CREATE POLICY "No direct update on nutrition-photo-logs"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'nutrition-photo-logs' AND false);

DROP POLICY IF EXISTS "No direct delete on nutrition-photo-logs" ON storage.objects;
CREATE POLICY "No direct delete on nutrition-photo-logs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'nutrition-photo-logs' AND false);
