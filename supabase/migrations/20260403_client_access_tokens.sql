-- ============================================================
-- CLIENT ACCESS TOKENS
-- Liens de connexion one-click générés par le coach pour ses clients.
-- Le coach génère, copie, révoque. Le client clique et accède.
-- ============================================================

create table if not exists public.client_access_tokens (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null references auth.users(id) on delete cascade,
  client_id    uuid not null references public.coach_clients(id) on delete cascade,
  token        text not null default encode(gen_random_bytes(32), 'hex'),
  magic_url    text,
  expires_at   timestamptz not null default (now() + interval '30 days'),
  revoked      boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint client_access_tokens_token_unique unique (token),
  constraint client_access_tokens_client_unique unique (client_id)
);

create index if not exists client_access_tokens_token_idx
  on public.client_access_tokens(token)
  where revoked = false;

alter table public.client_access_tokens enable row level security;

-- Le coach gère les tokens de ses clients
create policy "coach_own_access_tokens"
  on public.client_access_tokens for all
  using (auth.uid() = public.client_access_tokens.coach_id);
