-- ============================================================
-- Template Matching v2 — 3-phase algorithm
--
-- Phase 1 : Filtre univers — equipment_category sur le client
--           déverrouille/bloque des archétypes de templates
-- Phase 2 : Scoring strict — fréquence exacte, niveau ±1 max
-- Phase 3 : Substitution — movement_pattern sur exercices templates
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. client.equipment_category
--    Déterminé lors de l'onboarding — définit l'univers accessible
-- ────────────────────────────────────────────────────────────
alter table public.coach_clients
  add column if not exists equipment_category text
  check (equipment_category in (
    'bodyweight',          -- aucun matériel, poids du corps + élastiques
    'home_dumbbells',      -- haltères + élastiques + poids du corps
    'home_full',           -- haltères + barre + élastiques + kettlebell + poids du corps
    'commercial_gym',      -- salle commerciale — tout le matériel disponible
    'functional_box',      -- box / fonctionnel — barre, KB, anneaux, sled, TRX
    'home_rack'            -- rack à domicile — barre, haltères, poulie, élastiques
  ));

comment on column public.coach_clients.equipment_category is
  'Catégorie d''équipement disponible — Phase 1 du matching template (hard stop)';

-- ────────────────────────────────────────────────────────────
-- 2. template.equipment_archetype
--    Déclaré par le coach lors de la création du template
--    Doit correspondre à un equipment_category client pour être débloqué
-- ────────────────────────────────────────────────────────────
alter table public.coach_program_templates
  add column if not exists equipment_archetype text
  check (equipment_archetype in (
    'bodyweight',
    'home_dumbbells',
    'home_full',
    'commercial_gym',
    'functional_box',
    'home_rack'
  ));

comment on column public.coach_program_templates.equipment_archetype is
  'Archétype d''équipement requis — si absent du client, score = 0 (hard stop Phase 1)';

-- ────────────────────────────────────────────────────────────
-- 3. template_exercise.movement_pattern
--    Sous-pattern biomécanique de l'exercice dans le contexte du template
--    Utilisé par la Phase 3 pour trouver un substitut si équipement manquant
-- ────────────────────────────────────────────────────────────
alter table public.coach_program_template_exercises
  add column if not exists movement_pattern text
  check (movement_pattern in (
    'horizontal_push',   -- développé couché, pompes, dips
    'vertical_push',     -- développé militaire, overhead press
    'horizontal_pull',   -- rowing, tirage horizontal
    'vertical_pull',     -- traction, tirage vertical, chin-up
    'squat_pattern',     -- squat, fente, leg press, hack squat
    'hip_hinge',         -- soulevé de terre, hip thrust, good morning, RDL
    'knee_flexion',      -- leg curl, nordic, GHD
    'knee_extension',    -- leg extension, sissy squat
    'calf_raise',        -- extension mollets
    'elbow_flexion',     -- curl biceps
    'elbow_extension',   -- extension triceps, dips
    'lateral_raise',     -- élévation latérale, oiseau
    'carry',             -- marche fermier, sled
    'core_anti_flex',    -- planche, dead bug, hollow hold
    'core_flex',         -- crunch, sit-up, relevé de jambes
    'core_rotation'      -- rotation, pallof press, russian twist
  ));

comment on column public.coach_program_template_exercises.movement_pattern is
  'Sous-pattern biomécanique — Phase 3 substitution : si équipement manquant, cherche un substitut sur ce pattern';

-- ────────────────────────────────────────────────────────────
-- 4. template_exercise.equipment_required
--    Équipement spécifique requis pour CET exercice (pas l'archétype global)
--    Permet la substitution à la maille de l'exercice
-- ────────────────────────────────────────────────────────────
alter table public.coach_program_template_exercises
  add column if not exists equipment_required text[]
  not null default '{}';

comment on column public.coach_program_template_exercises.equipment_required is
  'Équipement requis pour cet exercice spécifique — utilisé pour la substitution Phase 3';

-- ────────────────────────────────────────────────────────────
-- 5. Index pour les requêtes de matching
-- ────────────────────────────────────────────────────────────
create index if not exists coach_clients_equipment_category_idx
  on public.coach_clients(equipment_category);

create index if not exists coach_program_templates_archetype_idx
  on public.coach_program_templates(equipment_archetype);

create index if not exists coach_program_templates_frequency_idx
  on public.coach_program_templates(frequency);

create index if not exists coach_program_template_exercises_pattern_idx
  on public.coach_program_template_exercises(movement_pattern);
