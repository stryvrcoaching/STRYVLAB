-- Client PWA realtime: nutrition, hydration, planned meals and notifications.
-- Browser subscriptions are filtered by RLS and client_id.

ALTER TABLE public.nutrition_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_water_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_nutrition_meals_realtime_select" ON public.nutrition_meals;
CREATE POLICY "client_nutrition_meals_realtime_select"
  ON public.nutrition_meals
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.coach_clients WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "client_water_logs_realtime_select" ON public.client_water_logs;
CREATE POLICY "client_water_logs_realtime_select"
  ON public.client_water_logs
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.coach_clients WHERE user_id = auth.uid()
    )
  );

DO $$
DECLARE
  realtime_table text;
BEGIN
  FOREACH realtime_table IN ARRAY ARRAY[
    'nutrition_meals',
    'client_water_logs',
    'client_nutrition_preps',
    'coach_client_notifications'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = realtime_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', realtime_table);
    END IF;
  END LOOP;
END $$;
