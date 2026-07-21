-- Allow the optional container used for up to five custom coach-page blocks.
ALTER TABLE public.coach_page_sections
  DROP CONSTRAINT IF EXISTS coach_page_sections_type_check;

ALTER TABLE public.coach_page_sections
  ADD CONSTRAINT coach_page_sections_type_check
  CHECK (type IN ('hero', 'about', 'formulas', 'gallery', 'testimonials', 'contact', 'custom'));
