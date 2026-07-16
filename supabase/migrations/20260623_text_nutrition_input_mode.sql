ALTER TABLE nutrition_entries
  DROP CONSTRAINT IF EXISTS nutrition_entries_input_mode_check;

ALTER TABLE nutrition_entries
  ADD CONSTRAINT nutrition_entries_input_mode_check
  CHECK (input_mode IN ('composer', 'portion', 'photo_ai', 'voice', 'text', 'photo_guided'));
