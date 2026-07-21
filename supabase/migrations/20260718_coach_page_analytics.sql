-- ============================================================
-- Coach Pages — analytics events + public private-page fix
-- 2026-07-18
-- ============================================================

-- Private published pages remain reachable by direct link
-- (is_private only controls indexing / marketing privacy).
DROP POLICY IF EXISTS "coach_pages_public_read"
  ON public.coach_pages;

CREATE POLICY "coach_pages_public_read"
  ON public.coach_pages
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "coach_page_sections_public_read"
  ON public.coach_page_sections;

CREATE POLICY "coach_page_sections_public_read"
  ON public.coach_page_sections
  FOR SELECT
  TO anon, authenticated
  USING (
    is_enabled = true
    AND EXISTS (
      SELECT 1
      FROM public.coach_pages cp
      WHERE cp.id = coach_page_sections.page_id
        AND cp.coach_id = coach_page_sections.coach_id
        AND cp.is_published = true
    )
  );

DROP POLICY IF EXISTS "coach_formulas_public_read_show_on_page"
  ON public.coach_formulas;

CREATE POLICY "coach_formulas_public_read_show_on_page"
  ON public.coach_formulas
  FOR SELECT
  TO anon, authenticated
  USING (
    show_on_page = true
    AND EXISTS (
      SELECT 1
      FROM public.coach_pages cp
      WHERE cp.coach_id = coach_formulas.coach_id
        AND cp.is_published = true
    )
  );

-- ─── Events table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_page_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     uuid NOT NULL REFERENCES public.coach_pages(id) ON DELETE CASCADE,
  coach_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  text NOT NULL
                CHECK (event_type IN ('view', 'cta_click', 'formula_click', 'share')),
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_page_events_page_id_created_idx
  ON public.coach_page_events (page_id, created_at DESC);

CREATE INDEX IF NOT EXISTS coach_page_events_coach_id_created_idx
  ON public.coach_page_events (coach_id, created_at DESC);

CREATE INDEX IF NOT EXISTS coach_page_events_type_idx
  ON public.coach_page_events (page_id, event_type);

ALTER TABLE public.coach_page_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_page_events_coach_read"
  ON public.coach_page_events;

CREATE POLICY "coach_page_events_coach_read"
  ON public.coach_page_events
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = coach_id);

DROP POLICY IF EXISTS "coach_page_events_public_insert"
  ON public.coach_page_events;

CREATE POLICY "coach_page_events_public_insert"
  ON public.coach_page_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.coach_pages cp
      WHERE cp.id = page_id
        AND cp.coach_id = coach_id
        AND cp.is_published = true
    )
  );

GRANT SELECT ON public.coach_page_events TO authenticated;
GRANT INSERT ON public.coach_page_events TO anon, authenticated;
