CREATE TABLE IF NOT EXISTS public.public_api_rate_limits (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.public_api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_public_api_rate_limit(
  p_bucket_key text,
  p_max_requests integer,
  p_window_seconds integer
)
RETURNS TABLE (allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_time timestamptz := clock_timestamp();
  current_count integer;
  current_window timestamptz;
BEGIN
  IF p_bucket_key IS NULL OR length(p_bucket_key) <> 64 THEN
    RAISE EXCEPTION 'invalid rate limit bucket';
  END IF;

  IF p_max_requests < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'invalid rate limit configuration';
  END IF;

  INSERT INTO public.public_api_rate_limits (
    bucket_key,
    window_started_at,
    request_count,
    updated_at
  )
  VALUES (p_bucket_key, v_current_time, 1, v_current_time)
  ON CONFLICT (bucket_key) DO UPDATE
  SET
    window_started_at = CASE
      WHEN public.public_api_rate_limits.window_started_at
        <= v_current_time - make_interval(secs => p_window_seconds)
      THEN v_current_time
      ELSE public.public_api_rate_limits.window_started_at
    END,
    request_count = CASE
      WHEN public.public_api_rate_limits.window_started_at
        <= v_current_time - make_interval(secs => p_window_seconds)
      THEN 1
      ELSE public.public_api_rate_limits.request_count + 1
    END,
    updated_at = v_current_time
  RETURNING request_count, window_started_at
  INTO current_count, current_window;

  allowed := current_count <= p_max_requests;
  retry_after_seconds := GREATEST(
    1,
    CEIL(EXTRACT(EPOCH FROM (
      current_window + make_interval(secs => p_window_seconds) - v_current_time
    )))::integer
  );

  RETURN NEXT;
END;
$$;

REVOKE ALL ON TABLE public.public_api_rate_limits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_public_api_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_public_api_rate_limit(text, integer, integer)
  TO service_role;
