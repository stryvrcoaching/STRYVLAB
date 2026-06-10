-- Fix: extend meal_type CHECK constraint to include 'drinks'
-- Required for /api/client/nutrition/hydration endpoint (boissons via food_items)

ALTER TABLE nutrition_meals
  DROP CONSTRAINT IF EXISTS nutrition_meals_meal_type_check;

ALTER TABLE nutrition_meals
  ADD CONSTRAINT nutrition_meals_meal_type_check
  CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'drinks'));
