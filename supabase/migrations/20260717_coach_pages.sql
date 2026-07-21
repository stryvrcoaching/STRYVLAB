-- ============================================================
-- Coach Pages — Mini-site builder
-- 2026-07-17
-- ============================================================

-- ─── 1. Table principale de la page coach ────────────────────
CREATE TABLE IF NOT EXISTS public.coach_pages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id       uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug           text UNIQUE NOT NULL,
  is_published   boolean NOT NULL DEFAULT false,
  is_private     boolean NOT NULL DEFAULT false,
  accent_color   text NOT NULL DEFAULT '#1f8a65',
  font_choice    text NOT NULL DEFAULT 'lufga'
                   CHECK (font_choice IN ('lufga', 'barlow', 'inter')),
  bg_choice      text NOT NULL DEFAULT 'dark'
                   CHECK (bg_choice IN ('dark', 'charcoal', 'slate')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ─── 2. Sections ordonnées de la page ────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_page_sections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id      uuid NOT NULL REFERENCES public.coach_pages(id) ON DELETE CASCADE,
  type         text NOT NULL
                 CHECK (type IN ('hero','about','formulas','gallery','testimonials','contact')),
  is_enabled   boolean NOT NULL DEFAULT true,
  position     smallint NOT NULL DEFAULT 0,
  content      jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, type)
);

-- ─── 3. Colonne show_on_page sur coach_formulas ───────────────
ALTER TABLE public.coach_formulas
  ADD COLUMN IF NOT EXISTS show_on_page boolean NOT NULL DEFAULT false;

-- ─── 4. Triggers updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'coach_pages_updated_at') THEN
    CREATE TRIGGER coach_pages_updated_at
      BEFORE UPDATE ON public.coach_pages
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'coach_page_sections_updated_at') THEN
    CREATE TRIGGER coach_page_sections_updated_at
      BEFORE UPDATE ON public.coach_page_sections
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- ─── 5. Index ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS coach_pages_slug_idx ON public.coach_pages (slug);
CREATE INDEX IF NOT EXISTS coach_pages_coach_id_idx ON public.coach_pages (coach_id);
CREATE INDEX IF NOT EXISTS coach_page_sections_page_id_idx ON public.coach_page_sections (page_id);
CREATE INDEX IF NOT EXISTS coach_formulas_show_on_page_idx ON public.coach_formulas (coach_id, show_on_page);

-- ─── 6. RLS — coach_pages ────────────────────────────────────
ALTER TABLE public.coach_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_pages_coach_crud"
  ON public.coach_pages;

CREATE POLICY "coach_pages_coach_crud"
  ON public.coach_pages
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = coach_id)
  WITH CHECK ((SELECT auth.uid()) = coach_id);

DROP POLICY IF EXISTS "coach_pages_public_read"
  ON public.coach_pages;

CREATE POLICY "coach_pages_public_read"
  ON public.coach_pages
  FOR SELECT
  TO anon, authenticated
  USING (
    is_published = true
    AND is_private = false
  );

-- ─── 7. RLS — coach_page_sections ────────────────────────────
ALTER TABLE public.coach_page_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_page_sections_coach_crud"
  ON public.coach_page_sections;

CREATE POLICY "coach_page_sections_coach_crud"
  ON public.coach_page_sections
  FOR ALL
  TO authenticated
  USING (
    (SELECT auth.uid()) = coach_id
    AND EXISTS (
      SELECT 1
      FROM public.coach_pages cp
      WHERE cp.id = coach_page_sections.page_id
        AND cp.coach_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = coach_id
    AND EXISTS (
      SELECT 1
      FROM public.coach_pages cp
      WHERE cp.id = coach_page_sections.page_id
        AND cp.coach_id = (SELECT auth.uid())
    )
  );

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
        AND cp.is_private = false
    )
  );

-- ─── 8. RLS — coach_formulas public SELECT show_on_page ──────
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
        AND cp.is_private = false
    )
  );

-- ─── 9. Permissions explicites ───────────────────────────────
GRANT SELECT ON public.coach_pages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.coach_pages TO authenticated;

GRANT SELECT ON public.coach_page_sections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.coach_page_sections TO authenticated;

GRANT SELECT ON public.coach_formulas TO anon, authenticated;
