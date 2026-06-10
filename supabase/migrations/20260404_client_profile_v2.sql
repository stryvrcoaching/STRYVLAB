-- ============================================================
-- Client profile v2
-- 1. client_preferences   — weight_unit, height_unit, language (client-side prefs)
-- 2. coach_clients        — profile_photo_url column
-- 3. client_notifications — extend type check + add client-facing RLS policy
-- 4. Storage bucket       — profile-photos
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. client_preferences
-- ────────────────────────────────────────────────────────────
create table if not exists public.client_preferences (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null unique references public.coach_clients(id) on delete cascade,
  weight_unit   text not null default 'kg'
                check (weight_unit in ('kg', 'lbs')),
  height_unit   text not null default 'cm'
                check (height_unit in ('cm', 'ft')),
  language      text not null default 'fr'
                check (language in ('fr', 'en', 'es')),
  -- Notification preferences
  notif_session_reminder  boolean not null default true,
  notif_bilan_received    boolean not null default true,
  notif_program_updated   boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists client_preferences_client_id_idx
  on public.client_preferences(client_id);

alter table public.client_preferences enable row level security;

-- Client can read/update own preferences
create policy "client_own_preferences"
  on public.client_preferences
  for all
  using (
    client_id in (
      select id from public.coach_clients where user_id = auth.uid()
    )
  );

-- Coach can read client preferences
create policy "coach_reads_client_preferences"
  on public.client_preferences
  for select
  using (
    client_id in (
      select id from public.coach_clients where coach_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 2. coach_clients — add profile_photo_url
-- ────────────────────────────────────────────────────────────
alter table public.coach_clients
  add column if not exists profile_photo_url text;

-- ────────────────────────────────────────────────────────────
-- 3. client_notifications — extend types + client RLS policy
-- ────────────────────────────────────────────────────────────

-- Drop existing type constraint to replace it
alter table public.client_notifications
  drop constraint if exists client_notifications_type_check;

alter table public.client_notifications
  add constraint client_notifications_type_check
  check (type in (
    'assessment_completed',
    'assessment_sent',
    'program_updated',
    'session_reminder',
    'bilan_received',
    'program_assigned'
  ));

-- Add target_user_id so a notification can target either coach or client
alter table public.client_notifications
  add column if not exists target_user_id uuid references auth.users(id) on delete cascade;

-- Index for client-facing notification lookup
create index if not exists client_notifications_target_user_idx
  on public.client_notifications(target_user_id, read)
  where read = false;

-- Client can read own notifications (where target_user_id = auth.uid())
create policy "client_own_notifications"
  on public.client_notifications
  for select
  using (auth.uid() = target_user_id);

-- Client can mark own notifications as read
create policy "client_mark_read"
  on public.client_notifications
  for update
  using (auth.uid() = target_user_id)
  with check (auth.uid() = target_user_id);

-- ────────────────────────────────────────────────────────────
-- 4. Storage bucket — profile-photos
-- ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Client can upload/update/delete their own photo (path: {client_id}/avatar.*)
create policy "client_upload_own_photo"
  on storage.objects
  for insert
  with check (
    bucket_id = 'profile-photos'
    and auth.uid() is not null
  );

create policy "client_update_own_photo"
  on storage.objects
  for update
  using (bucket_id = 'profile-photos' and auth.uid() is not null);

create policy "client_delete_own_photo"
  on storage.objects
  for delete
  using (bucket_id = 'profile-photos' and auth.uid() is not null);

-- Authenticated users (coach + client) can read profile photos
create policy "authenticated_read_profile_photos"
  on storage.objects
  for select
  using (bucket_id = 'profile-photos' and auth.role() = 'authenticated');
