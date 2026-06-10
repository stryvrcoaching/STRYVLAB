-- ─── Coach Profiles ───────────────────────────────────────────────────────────
-- Stores coach-specific profile data that goes beyond Supabase Auth metadata:
-- branding, billing info, notification preferences.

CREATE TABLE IF NOT EXISTS public.coach_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Profil
  full_name   text,
  brand_name  text,
  pro_email   text,
  phone       text,
  logo_url    text,

  -- Facturation
  siret       text,
  address     text,
  vat_number  text,

  -- Notifications
  notif_payment_reminder      boolean NOT NULL DEFAULT true,
  notif_payment_reminder_days integer NOT NULL DEFAULT 3,
  notif_bilan_completed       boolean NOT NULL DEFAULT true,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_profiles_select_own"
  ON public.coach_profiles FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "coach_profiles_insert_own"
  ON public.coach_profiles FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "coach_profiles_update_own"
  ON public.coach_profiles FOR UPDATE
  USING (auth.uid() = coach_id);

CREATE POLICY "coach_profiles_delete_own"
  ON public.coach_profiles FOR DELETE
  USING (auth.uid() = coach_id);

-- Index
CREATE INDEX IF NOT EXISTS coach_profiles_coach_id_idx ON public.coach_profiles (coach_id);

-- ─── Supabase Storage bucket: coach-assets ────────────────────────────────────
-- Run this separately in Supabase dashboard Storage > New bucket
-- OR via the Storage API. The SQL below uses the storage schema if available.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'coach-assets',
  'coach-assets',
  false,
  31457280,  -- 30 MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: coach can only access their own folder (coach_id/*)
CREATE POLICY "coach_assets_select_own"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'coach-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "coach_assets_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'coach-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "coach_assets_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'coach-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "coach_assets_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'coach-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
