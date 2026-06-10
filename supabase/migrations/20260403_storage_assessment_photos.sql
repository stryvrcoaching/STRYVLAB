-- ============================================================
-- STORAGE — Bucket assessment-photos
-- Bucket privé : accessible uniquement via service role key
-- (signed URLs générées par l'API Next.js)
-- ============================================================

-- Créer le bucket s'il n'existe pas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assessment-photos',
  'assessment-photos',
  false,                          -- privé : jamais d'URL publique directe
  31457280,                       -- 30 Mo max par fichier (aligne avec CHANGELOG & widget)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RLS POLICIES
-- L'API utilise le service role key (bypass RLS).
-- On bloque tout accès direct pour les rôles non-service.
-- ============================================================

-- Interdire tout accès en lecture directe (authenticated ou anon)
CREATE POLICY "No public read on assessment-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'assessment-photos' AND false);

-- Interdire tout upload direct (l'upload passe par signed URL via service role)
CREATE POLICY "No direct insert on assessment-photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'assessment-photos' AND false);

-- Interdire tout delete direct
CREATE POLICY "No direct delete on assessment-photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'assessment-photos' AND false);
