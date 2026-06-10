-- supabase/migrations/20260428_morpho_photos_annotations.sql

-- Table morpho_photos : index centralisé de toutes les photos morpho client
create table if not exists public.morpho_photos (
  id                     uuid primary key default gen_random_uuid(),
  client_id              uuid not null references public.coach_clients(id) on delete cascade,
  coach_id               uuid not null references auth.users(id),
  storage_path           text not null,
  position               text not null check (position in (
                           'front', 'back', 'left', 'right',
                           'three_quarter_front_left', 'three_quarter_front_right'
                         )),
  taken_at               date not null,
  source                 text not null check (source in ('assessment', 'coach_upload')),
  assessment_response_id uuid unique references public.assessment_responses(id) on delete set null,
  notes                  text,
  created_at             timestamptz not null default now()
);

create index if not exists morpho_photos_client_id_idx
  on public.morpho_photos(client_id);
create index if not exists morpho_photos_client_taken_at_idx
  on public.morpho_photos(client_id, taken_at desc);

-- RLS morpho_photos
alter table public.morpho_photos enable row level security;

create policy "Coach accès ses photos clients" on public.morpho_photos
  for all using (
    client_id in (
      select id from public.coach_clients where coach_id = auth.uid()
    )
  );

-- Table morpho_annotations : canvas Fabric.js par photo
create table if not exists public.morpho_annotations (
  id                uuid primary key default gen_random_uuid(),
  photo_id          uuid not null references public.morpho_photos(id) on delete cascade,
  coach_id          uuid not null references auth.users(id),
  canvas_data       jsonb not null default '{}',
  thumbnail_path    text,
  analysis_snapshot jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (photo_id, coach_id)
);

drop trigger if exists morpho_annotations_updated_at on public.morpho_annotations;
create trigger morpho_annotations_updated_at
  before update on public.morpho_annotations
  for each row execute function public.set_updated_at();

-- RLS morpho_annotations
alter table public.morpho_annotations enable row level security;

create policy "Coach accès ses annotations" on public.morpho_annotations
  for all using (coach_id = auth.uid());
