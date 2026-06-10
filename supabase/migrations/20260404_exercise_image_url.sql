-- Add image_url to template exercises
alter table public.coach_program_template_exercises
  add column if not exists image_url text;
