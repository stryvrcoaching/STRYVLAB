-- Link metric_annotations to the resource that created them (program, protocol, etc.)
ALTER TABLE metric_annotations
  ADD COLUMN IF NOT EXISTS source_id UUID NULL;

-- Index for fast lookup when cleaning up annotations on resource delete
CREATE INDEX IF NOT EXISTS idx_metric_annotations_source
  ON metric_annotations(source_id)
  WHERE source_id IS NOT NULL;
