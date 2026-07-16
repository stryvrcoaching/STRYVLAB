-- Keeps the periodic pending-assessment reminder query efficient.
CREATE INDEX IF NOT EXISTS assessment_submissions_pending_reminder_idx
  ON public.assessment_submissions (created_at ASC)
  WHERE status = 'pending' AND token IS NOT NULL;
