CREATE TABLE IF NOT EXISTS public.product_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace text NOT NULL
    CHECK (workspace IN ('client_pwa', 'platform_web')),
  source_role text NOT NULL
    CHECK (source_role IN ('client', 'coach')),
  source_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_name text,
  source_email text,
  coach_client_id uuid REFERENCES public.coach_clients(id) ON DELETE SET NULL,
  coach_profile_id uuid REFERENCES public.coach_profiles(id) ON DELETE SET NULL,
  page_path text NOT NULL,
  page_title text,
  category text NOT NULL
    CHECK (category IN ('bug', 'usability', 'suggestion')),
  priority_user text NOT NULL
    CHECK (priority_user IN ('low', 'medium', 'critical')),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewed', 'planned', 'done', 'dismissed')),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_feedback ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS product_feedback_created_at_idx
  ON public.product_feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS product_feedback_workspace_status_idx
  ON public.product_feedback (workspace, status, created_at DESC);

CREATE INDEX IF NOT EXISTS product_feedback_page_path_idx
  ON public.product_feedback (page_path);

CREATE INDEX IF NOT EXISTS product_feedback_priority_idx
  ON public.product_feedback (priority_user, created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'product_feedback_updated_at'
  ) THEN
    CREATE TRIGGER product_feedback_updated_at
      BEFORE UPDATE ON public.product_feedback
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
