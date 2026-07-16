-- Align coach template movement_pattern constraint with builder/API values.
alter table public.coach_program_template_exercises
  drop constraint if exists coach_program_template_exercises_movement_pattern_check;

alter table public.coach_program_template_exercises
  add constraint coach_program_template_exercises_movement_pattern_check
  check (
    movement_pattern is null
    or movement_pattern in (
      'horizontal_push',
      'vertical_push',
      'horizontal_pull',
      'vertical_pull',
      'squat_pattern',
      'hip_hinge',
      'knee_flexion',
      'knee_extension',
      'calf_raise',
      'wrist_flexion',
      'wrist_extension',
      'forearm_rotation',
      'elbow_flexion',
      'elbow_extension',
      'lateral_raise',
      'hip_abduction',
      'hip_adduction',
      'shoulder_rotation',
      'carry',
      'scapular_elevation',
      'scapular_retraction',
      'scapular_protraction',
      'core_anti_flex',
      'core_flex',
      'core_rotation'
    )
  );
