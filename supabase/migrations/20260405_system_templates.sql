-- ============================================================
-- System Templates — 5 archétypes fondamentaux
--
-- Modifications :
--   1. is_system boolean — templates non-modifiables par les coaches
--   2. coach_id nullable — les templates système n'ont pas de propriétaire
--   3. slug text unique nullable — permet l'idempotence des seeds
--   4. RLS additionnelle — SELECT public sur is_system = true
--   5. Policy UPDATE/DELETE — bloque la modification des templates système
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Colonne is_system
-- ────────────────────────────────────────────────────────────
alter table public.coach_program_templates
  add column if not exists is_system boolean not null default false;

comment on column public.coach_program_templates.is_system is
  'true = template système (non modifiable par les coaches, visible par tous)';

-- ────────────────────────────────────────────────────────────
-- 2. coach_id nullable (templates système n'ont pas de propriétaire)
-- ────────────────────────────────────────────────────────────
alter table public.coach_program_templates
  alter column coach_id drop not null;

comment on column public.coach_program_templates.coach_id is
  'NULL pour les templates système — coach_id requis pour les templates coach';

-- ────────────────────────────────────────────────────────────
-- 3. Slug unique pour l'idempotence des seeds
-- ────────────────────────────────────────────────────────────
alter table public.coach_program_templates
  add column if not exists slug text;

create unique index if not exists coach_program_templates_slug_idx
  on public.coach_program_templates(slug)
  where slug is not null;

comment on column public.coach_program_templates.slug is
  'Identifiant stable pour les templates système (idempotence seed). NULL pour les templates coach.';

-- ────────────────────────────────────────────────────────────
-- 4. RLS — SELECT public pour les templates système
-- ────────────────────────────────────────────────────────────
-- Policy existante : coach_own_program_templates → coach voit ses propres templates
-- Nouvelle policy : tout coach authentifié voit les templates système

create policy "read_system_templates"
  on public.coach_program_templates for select
  using (is_system = true and auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- 5. Bloquer UPDATE / DELETE sur les templates système
--    (seul le service role peut modifier)
-- ────────────────────────────────────────────────────────────
create policy "block_system_template_update"
  on public.coach_program_templates for update
  using (is_system = false);

create policy "block_system_template_delete"
  on public.coach_program_templates for delete
  using (is_system = false);

-- ────────────────────────────────────────────────────────────
-- 6. Index is_system pour les requêtes de listing
-- ────────────────────────────────────────────────────────────
create index if not exists coach_program_templates_is_system_idx
  on public.coach_program_templates(is_system);
