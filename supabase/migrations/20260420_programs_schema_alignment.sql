-- ============================================================
-- Align programs + program_exercises with template schema
-- so ProgramTemplateBuilder can edit client programs directly
-- ============================================================

-- programs: add metadata fields matching coach_program_templates
alter table public.programs
  add column if not exists goal text default 'hypertrophy'
    check (goal in ('hypertrophy','strength','endurance','fat_loss','recomp','maintenance','athletic')),
  add column if not exists level text default 'intermediate'
    check (level in ('beginner','intermediate','advanced','elite')),
  add column if not exists frequency int default 3 check (frequency between 1 and 7),
  add column if not exists muscle_tags text[] default '{}',
  add column if not exists equipment_archetype text
    check (equipment_archetype in ('bodyweight','home_dumbbells','home_full','commercial_gym','functional_box','home_rack')),
  add column if not exists session_mode text not null default 'day'
    check (session_mode in ('day','cycle'));

-- program_sessions: add session_mode mirroring (already on templates, needed on sessions too for ordering)
-- (session_mode lives on the program level, sessions just need position already there)

-- program_exercises: add rich metadata fields matching coach_program_template_exercises
alter table public.program_exercises
  add column if not exists movement_pattern text,
  add column if not exists equipment_required text[] default '{}',
  add column if not exists group_id text,
  add column if not exists is_compound boolean,
  add column if not exists target_rir int,
  add column if not exists weight_increment_kg numeric default 2.5,
  add column if not exists primary_muscles text[] default '{}',
  add column if not exists secondary_muscles text[] default '{}';
