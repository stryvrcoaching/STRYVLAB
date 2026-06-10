-- food_item_translations: multilingual names for food items
-- Follows same pattern as exercise_translations, muscle_translations

CREATE TABLE IF NOT EXISTS food_item_translations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  food_item_id uuid        NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
  lang         text        NOT NULL CHECK (lang IN ('fr', 'en', 'es')),
  name         text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (food_item_id, lang)
);

CREATE INDEX IF NOT EXISTS idx_food_item_translations_food_item ON food_item_translations(food_item_id);
CREATE INDEX IF NOT EXISTS idx_food_item_translations_lang      ON food_item_translations(lang);

-- Backfill FR from existing name_fr (idempotent)
INSERT INTO food_item_translations (food_item_id, lang, name)
SELECT id, 'fr', name_fr
FROM food_items
ON CONFLICT (food_item_id, lang) DO NOTHING;
