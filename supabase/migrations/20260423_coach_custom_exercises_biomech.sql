-- Extend coach_custom_exercises with full biomechanical schema
-- Aligns custom exercises with the enriched catalog JSON fields

ALTER TABLE coach_custom_exercises
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IN ('image', 'gif', 'video')),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS plane text CHECK (plane IN ('sagittal', 'frontal', 'transverse')),
  ADD COLUMN IF NOT EXISTS mechanic text CHECK (mechanic IN ('isolation', 'compound', 'isometric', 'plyometric')),
  ADD COLUMN IF NOT EXISTS unilateral boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS primary_muscle text,
  ADD COLUMN IF NOT EXISTS primary_activation numeric(3,2) CHECK (primary_activation BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS secondary_muscles_detail text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_activations numeric(3,2)[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stabilizers text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS joint_stress_spine integer CHECK (joint_stress_spine BETWEEN 1 AND 8),
  ADD COLUMN IF NOT EXISTS joint_stress_knee integer CHECK (joint_stress_knee BETWEEN 1 AND 8),
  ADD COLUMN IF NOT EXISTS joint_stress_shoulder integer CHECK (joint_stress_shoulder BETWEEN 1 AND 8),
  ADD COLUMN IF NOT EXISTS global_instability integer CHECK (global_instability BETWEEN 1 AND 9),
  ADD COLUMN IF NOT EXISTS coordination_demand integer CHECK (coordination_demand BETWEEN 1 AND 9),
  ADD COLUMN IF NOT EXISTS constraint_profile text;
