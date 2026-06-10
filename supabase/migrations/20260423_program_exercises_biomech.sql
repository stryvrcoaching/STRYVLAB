-- Add biomechanical columns to template and program exercise tables
-- These are populated automatically when an exercise is added from the picker
-- NULL = exercise created before this migration (graceful degradation in scoring)

ALTER TABLE coach_program_template_exercises
  ADD COLUMN IF NOT EXISTS plane text,
  ADD COLUMN IF NOT EXISTS mechanic text,
  ADD COLUMN IF NOT EXISTS unilateral boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS primary_muscle text,
  ADD COLUMN IF NOT EXISTS primary_activation numeric(3,2),
  ADD COLUMN IF NOT EXISTS secondary_muscles_detail text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_activations numeric(3,2)[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stabilizers text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS joint_stress_spine integer,
  ADD COLUMN IF NOT EXISTS joint_stress_knee integer,
  ADD COLUMN IF NOT EXISTS joint_stress_shoulder integer,
  ADD COLUMN IF NOT EXISTS global_instability integer,
  ADD COLUMN IF NOT EXISTS coordination_demand integer,
  ADD COLUMN IF NOT EXISTS constraint_profile text;

ALTER TABLE program_exercises
  ADD COLUMN IF NOT EXISTS plane text,
  ADD COLUMN IF NOT EXISTS mechanic text,
  ADD COLUMN IF NOT EXISTS unilateral boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS primary_muscle text,
  ADD COLUMN IF NOT EXISTS primary_activation numeric(3,2),
  ADD COLUMN IF NOT EXISTS secondary_muscles_detail text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_activations numeric(3,2)[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stabilizers text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS joint_stress_spine integer,
  ADD COLUMN IF NOT EXISTS joint_stress_knee integer,
  ADD COLUMN IF NOT EXISTS joint_stress_shoulder integer,
  ADD COLUMN IF NOT EXISTS global_instability integer,
  ADD COLUMN IF NOT EXISTS coordination_demand integer,
  ADD COLUMN IF NOT EXISTS constraint_profile text;
