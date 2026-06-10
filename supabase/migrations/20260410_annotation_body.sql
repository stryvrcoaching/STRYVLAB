-- Add rich text body to metric_annotations
-- label = short title (required), body = optional long-form content

ALTER TABLE metric_annotations
  ADD COLUMN IF NOT EXISTS body TEXT;
