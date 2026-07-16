-- Migration: Decouple exercise_translations from the exercises table FK
--
-- Context:
--   The exercise_translations table was originally constrained to exercises.id (UUID).
--   However, the exercise catalog used by the PWA is managed via a local JSON file
--   (data/exercise-catalog.json) compiled from CSV schemas, NOT via the exercises table.
--   As a result, all new exercises imported via import-option-a.ts had no row in
--   `exercises`, causing FK violations (error 23503) when inserting translations.
--
--   Additionally, the client page lookup (page.tsx) uses:
--     exerciseDict[set.exercise_name]
--   where set.exercise_name is the French exercise name stored in client_set_logs.
--   So exerciseId must store the French name (not a UUID) to make lookups work.
--
-- This migration:
--   1. Drops the foreign key constraint on exercise_translations.exerciseId
--   2. Leaves the column as a plain text field (indexed for performance)
--   3. Allows exerciseId to store either a UUID (legacy) or a French name (new catalog)

-- Step 1: Drop FK constraint
ALTER TABLE public.exercise_translations
  DROP CONSTRAINT IF EXISTS "exercise_translations_exerciseId_fkey";

-- Step 2: Ensure an index exists for lookup performance
CREATE INDEX IF NOT EXISTS exercise_translations_exercise_id_lang_idx
  ON public.exercise_translations ("exerciseId", lang);

-- Step 3: Add unique constraint to prevent duplicate translations
ALTER TABLE public.exercise_translations
  DROP CONSTRAINT IF EXISTS exercise_translations_exercise_id_lang_unique;

ALTER TABLE public.exercise_translations
  ADD CONSTRAINT exercise_translations_exercise_id_lang_unique
  UNIQUE ("exerciseId", lang);
