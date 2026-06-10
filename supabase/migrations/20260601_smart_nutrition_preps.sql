-- Smart Nutrition Prep: simulated meals that do not affect the real daily log.
-- Wrapped in one statement so it can also be applied through `supabase db query -f`.
DO $$
BEGIN
  EXECUTE $sql$
    CREATE TABLE IF NOT EXISTS public.client_nutrition_preps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES public.coach_clients(id) ON DELETE CASCADE,
      physiological_date DATE NOT NULL,
      title TEXT,
      meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
      status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'logged', 'cancelled')),
      entries JSONB NOT NULL DEFAULT '[]',
      total_calories NUMERIC(8,1) NOT NULL DEFAULT 0,
      total_protein_g NUMERIC(6,1) NOT NULL DEFAULT 0,
      total_carbs_g NUMERIC(6,1) NOT NULL DEFAULT 0,
      total_fat_g NUMERIC(6,1) NOT NULL DEFAULT 0,
      total_fiber_g NUMERIC(6,1) NOT NULL DEFAULT 0,
      consumed_meal_id UUID REFERENCES public.nutrition_meals(id) ON DELETE SET NULL,
      planned_for TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  $sql$;

  EXECUTE $sql$
    CREATE INDEX IF NOT EXISTS idx_client_nutrition_preps_client_date
      ON public.client_nutrition_preps(client_id, physiological_date, status, created_at DESC)
  $sql$;

  EXECUTE 'ALTER TABLE public.client_nutrition_preps ENABLE ROW LEVEL SECURITY';

  EXECUTE 'DROP POLICY IF EXISTS "client_nutrition_preps_client" ON public.client_nutrition_preps';
  EXECUTE $sql$
    CREATE POLICY "client_nutrition_preps_client" ON public.client_nutrition_preps
      FOR ALL
      USING (
        client_id IN (
          SELECT id FROM public.coach_clients WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        client_id IN (
          SELECT id FROM public.coach_clients WHERE user_id = auth.uid()
        )
      )
  $sql$;

  EXECUTE 'DROP POLICY IF EXISTS "client_nutrition_preps_coach" ON public.client_nutrition_preps';
  EXECUTE $sql$
    CREATE POLICY "client_nutrition_preps_coach" ON public.client_nutrition_preps
      FOR SELECT
      USING (
        client_id IN (
          SELECT id FROM public.coach_clients WHERE coach_id = auth.uid()
        )
      )
  $sql$;

  EXECUTE 'DROP TRIGGER IF EXISTS set_client_nutrition_preps_updated_at ON public.client_nutrition_preps';
  EXECUTE $sql$
    CREATE TRIGGER set_client_nutrition_preps_updated_at
      BEFORE UPDATE ON public.client_nutrition_preps
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at()
  $sql$;
END $$;
