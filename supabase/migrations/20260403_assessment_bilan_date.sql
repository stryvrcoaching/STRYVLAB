-- Add bilan_date to assessment_submissions
-- Allows coach to set the date of the bilan independently from created_at

alter table public.assessment_submissions
  add column if not exists bilan_date date not null default current_date;

comment on column public.assessment_submissions.bilan_date
  is 'Date du bilan choisie par le coach (indépendante de la date de création)';
