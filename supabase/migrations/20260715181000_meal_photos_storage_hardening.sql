INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meal-photos',
  'meal-photos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "No public read on meal-photos" ON storage.objects;
CREATE POLICY "No public read on meal-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'meal-photos' AND false);

DROP POLICY IF EXISTS "No direct insert on meal-photos" ON storage.objects;
CREATE POLICY "No direct insert on meal-photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'meal-photos' AND false);

DROP POLICY IF EXISTS "No direct update on meal-photos" ON storage.objects;
CREATE POLICY "No direct update on meal-photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'meal-photos' AND false);

DROP POLICY IF EXISTS "No direct delete on meal-photos" ON storage.objects;
CREATE POLICY "No direct delete on meal-photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'meal-photos' AND false);
