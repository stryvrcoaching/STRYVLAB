-- Permanent client food profile used by assessments, Nutrition Studio and future AI.

create table if not exists public.client_food_profiles (
  client_id uuid primary key references public.coach_clients(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  allergy_status text not null default 'unknown'
    check (allergy_status in ('unknown', 'none', 'declared')),
  version integer not null default 1 check (version > 0),
  last_source_type text
    check (last_source_type is null or last_source_type in ('assessment', 'coach', 'client', 'system')),
  last_source_id uuid,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_food_rules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (
    kind in ('allergy', 'intolerance', 'framework', 'liked', 'disliked', 'must_keep')
  ),
  target_type text not null check (
    target_type in ('food_item', 'taxonomy', 'free_text')
  ),
  food_item_id uuid references public.food_items(id) on delete set null,
  taxonomy_key text,
  label text not null,
  severity text check (
    severity is null or severity in ('avoid', 'strict', 'trace_caution')
  ),
  active boolean not null default true,
  classification_status text not null default 'classified' check (
    classification_status in ('classified', 'unclassified', 'needs_review')
  ),
  source_type text not null check (
    source_type in ('assessment', 'coach', 'client', 'system')
  ),
  source_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  deactivated_at timestamptz,
  deactivated_by uuid references auth.users(id) on delete set null,
  deactivation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (target_type = 'food_item' and food_item_id is not null)
    or (target_type = 'taxonomy' and taxonomy_key is not null)
    or (target_type = 'free_text')
  )
);

create table if not exists public.client_food_profile_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  profile_version integer not null check (profile_version > 0),
  event_type text not null check (
    event_type in ('profile_created', 'assessment_sync', 'rules_updated', 'allergy_removed')
  ),
  actor_id uuid references auth.users(id) on delete set null,
  source_type text not null check (
    source_type in ('assessment', 'coach', 'client', 'system')
  ),
  source_id uuid,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists client_food_rules_client_active_idx
  on public.client_food_rules(client_id, active);
create index if not exists client_food_rules_food_item_idx
  on public.client_food_rules(food_item_id)
  where food_item_id is not null and active = true;
create index if not exists client_food_profile_events_client_idx
  on public.client_food_profile_events(client_id, created_at desc);

drop trigger if exists client_food_profiles_updated_at on public.client_food_profiles;
create trigger client_food_profiles_updated_at
  before update on public.client_food_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists client_food_rules_updated_at on public.client_food_rules;
create trigger client_food_rules_updated_at
  before update on public.client_food_rules
  for each row execute function public.set_updated_at();

alter table public.client_food_profiles enable row level security;
alter table public.client_food_rules enable row level security;
alter table public.client_food_profile_events enable row level security;

drop policy if exists "coach_manages_client_food_profiles" on public.client_food_profiles;
create policy "coach_manages_client_food_profiles"
  on public.client_food_profiles for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

drop policy if exists "client_reads_own_food_profile" on public.client_food_profiles;
create policy "client_reads_own_food_profile"
  on public.client_food_profiles for select
  using (
    client_id in (
      select id from public.coach_clients where user_id = auth.uid()
    )
  );

drop policy if exists "coach_manages_client_food_rules" on public.client_food_rules;
create policy "coach_manages_client_food_rules"
  on public.client_food_rules for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

drop policy if exists "client_reads_own_food_rules" on public.client_food_rules;
create policy "client_reads_own_food_rules"
  on public.client_food_rules for select
  using (
    client_id in (
      select id from public.coach_clients where user_id = auth.uid()
    )
  );

drop policy if exists "coach_reads_client_food_events" on public.client_food_profile_events;
create policy "coach_reads_client_food_events"
  on public.client_food_profile_events for select
  using (coach_id = auth.uid());

drop policy if exists "client_reads_own_food_events" on public.client_food_profile_events;
create policy "client_reads_own_food_events"
  on public.client_food_profile_events for select
  using (
    client_id in (
      select id from public.coach_clients where user_id = auth.uid()
    )
  );

-- Explicit metadata replaces name-based detection for recommended templates.
alter table public.assessment_templates
  add column if not exists origin text not null default 'coach'
    check (origin in ('coach', 'stryv_system'));
alter table public.assessment_templates
  add column if not exists system_key text;
alter table public.assessment_templates
  add column if not exists system_version integer;
alter table public.assessment_templates
  add column if not exists source_template_id uuid references public.assessment_templates(id) on delete set null;

create unique index if not exists assessment_templates_coach_system_key_uidx
  on public.assessment_templates(coach_id, system_key)
  where system_key is not null;

-- Optional structured metadata for compatibility. Existing rows remain unknown.
alter table public.food_items
  add column if not exists dietary_tags text[] not null default '{}';
alter table public.food_items
  add column if not exists allergen_tags text[] not null default '{}';
alter table public.food_items
  add column if not exists ingredients_known boolean not null default false;

-- The verified internal catalogue contains atomic foods with a known identity.
-- User-created foods remain conservative until reviewed.
update public.food_items
set ingredients_known = true
where source = 'internal' and is_verified = true;
