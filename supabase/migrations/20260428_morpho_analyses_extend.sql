-- supabase/migrations/20260428_morpho_analyses_extend.sql

alter table public.morpho_analyses
  add column if not exists photo_ids uuid[] default '{}',
  add column if not exists analysis_result jsonb;
