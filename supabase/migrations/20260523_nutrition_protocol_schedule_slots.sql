ALTER TABLE public.nutrition_protocols
ADD COLUMN IF NOT EXISTS schedule_start_date date;

UPDATE public.nutrition_protocols
SET schedule_start_date = COALESCE(schedule_start_date, created_at::date)
WHERE schedule_start_date IS NULL;

ALTER TABLE public.nutrition_protocols
ALTER COLUMN schedule_start_date SET DEFAULT CURRENT_DATE;

CREATE TABLE IF NOT EXISTS public.nutrition_protocol_schedule_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id uuid NOT NULL REFERENCES public.nutrition_protocols(id) ON DELETE CASCADE,
  week_index int NOT NULL CHECK (week_index BETWEEN 1 AND 4),
  dow int NOT NULL CHECK (dow BETWEEN 1 AND 7),
  protocol_day_position int NOT NULL CHECK (protocol_day_position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (protocol_id, week_index, dow)
);

CREATE INDEX IF NOT EXISTS idx_nutrition_protocol_schedule_slots_protocol
ON public.nutrition_protocol_schedule_slots (protocol_id, week_index, dow);

ALTER TABLE public.nutrition_protocol_schedule_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_nutrition_protocol_schedule_slots" ON public.nutrition_protocol_schedule_slots;
CREATE POLICY "coach_nutrition_protocol_schedule_slots"
ON public.nutrition_protocol_schedule_slots
FOR ALL USING (
  protocol_id IN (
    SELECT np.id
    FROM public.nutrition_protocols np
    JOIN public.coach_clients cc ON cc.id = np.client_id
    WHERE cc.coach_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "client_nutrition_protocol_schedule_slots_read" ON public.nutrition_protocol_schedule_slots;
CREATE POLICY "client_nutrition_protocol_schedule_slots_read"
ON public.nutrition_protocol_schedule_slots
FOR SELECT USING (
  protocol_id IN (
    SELECT np.id
    FROM public.nutrition_protocols np
    JOIN public.coach_clients cc ON cc.id = np.client_id
    WHERE np.status = 'shared' AND cc.user_id = auth.uid()
  )
);
