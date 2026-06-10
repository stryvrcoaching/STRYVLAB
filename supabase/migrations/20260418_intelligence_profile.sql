-- Add structured injury fields to metric_annotations
ALTER TABLE metric_annotations
  ADD COLUMN IF NOT EXISTS body_part text,
  ADD COLUMN IF NOT EXISTS severity  text
    CHECK (severity IN ('avoid', 'limit', 'monitor'));

-- Add equipment list to coach_clients
ALTER TABLE coach_clients
  ADD COLUMN IF NOT EXISTS equipment text[] DEFAULT '{}';
