-- Add missing columns to coach_program_template_exercises
-- Required for exercise configuration to survive template cloning + biomechanics data
-- Aligns template exercises schema with program_exercises biomech enrichment

ALTER TABLE public.coach_program_template_exercises
  ADD COLUMN IF NOT EXISTS is_compound boolean DEFAULT NULL,
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
