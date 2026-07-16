CREATE TABLE IF NOT EXISTS public.product_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id text,
  session_id text,
  event_name text NOT NULL,
  page_path text,
  route_group text,
  source text,
  feature_key text,
  user_type text,
  referrer_domain text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS product_events_created_at_idx
  ON public.product_events (created_at DESC);

CREATE INDEX IF NOT EXISTS product_events_event_name_idx
  ON public.product_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS product_events_page_path_idx
  ON public.product_events (page_path, created_at DESC);

CREATE INDEX IF NOT EXISTS product_events_source_idx
  ON public.product_events (source, created_at DESC);

CREATE INDEX IF NOT EXISTS product_events_feature_key_idx
  ON public.product_events (feature_key, created_at DESC);

CREATE INDEX IF NOT EXISTS product_events_user_id_idx
  ON public.product_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
