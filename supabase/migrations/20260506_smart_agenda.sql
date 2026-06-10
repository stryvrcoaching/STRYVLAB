-- supabase/migrations/20260506_smart_agenda.sql

-- 1. Extend meal_logs
ALTER TABLE public.meal_logs
  ADD COLUMN IF NOT EXISTS transcript TEXT,
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_status TEXT DEFAULT 'pending' CHECK (ai_status IN ('pending', 'done', 'failed'));

-- 2. smart_agenda_events
CREATE TABLE IF NOT EXISTS public.smart_agenda_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.coach_clients(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL CHECK (event_type IN ('meal', 'checkin', 'session', 'assessment')),
  event_date  DATE NOT NULL,
  event_time  TIME,
  source_id   UUID,
  title       TEXT,
  summary     TEXT,
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sae_client_date ON public.smart_agenda_events (client_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_sae_client_type_date ON public.smart_agenda_events (client_id, event_type, event_date);

-- RLS
ALTER TABLE public.smart_agenda_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_sees_agenda_events" ON public.smart_agenda_events;
CREATE POLICY "coach_sees_agenda_events" ON public.smart_agenda_events
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_clients cc
    WHERE cc.id = smart_agenda_events.client_id AND cc.coach_id = auth.uid()
  ));

DROP POLICY IF EXISTS "client_own_agenda_events" ON public.smart_agenda_events;
CREATE POLICY "client_own_agenda_events" ON public.smart_agenda_events
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_clients cc
    WHERE cc.id = smart_agenda_events.client_id AND cc.user_id = auth.uid()
  ));

-- 3. coach_agenda_annotations (Phase 2 table — created now, used in Phase 2)
CREATE TABLE IF NOT EXISTS public.coach_agenda_annotations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL,
  client_id   UUID NOT NULL REFERENCES public.coach_clients(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES public.smart_agenda_events(id) ON DELETE CASCADE,
  note        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  read_at     TIMESTAMPTZ
);

ALTER TABLE public.coach_agenda_annotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_owns_annotations" ON public.coach_agenda_annotations;
CREATE POLICY "coach_owns_annotations" ON public.coach_agenda_annotations
  FOR ALL TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "client_sees_annotations" ON public.coach_agenda_annotations;
CREATE POLICY "client_sees_annotations" ON public.coach_agenda_annotations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_clients cc
    WHERE cc.id = coach_agenda_annotations.client_id AND cc.user_id = auth.uid()
  ));
