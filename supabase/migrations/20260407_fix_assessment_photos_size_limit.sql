-- ============================================================
-- FIX: Augmenter la limite de taille du bucket assessment-photos
-- Alignement avec la validation client (30 Mo)
-- ============================================================

-- Mettre à jour la limite de fichier du bucket
UPDATE storage.buckets
SET file_size_limit = 31457280  -- 30 Mo = 31457280 bytes
WHERE id = 'assessment-photos';

-- Vérification
SELECT id, name, file_size_limit FROM storage.buckets WHERE id = 'assessment-photos';
