-- ─── Training phases ──────────────────────────────────────────────────────────
-- A training phase is a named period (bulk, cut, maintenance, peak, deload)
-- attached to a client, used to overlay context on metric charts.

CREATE TABLE IF NOT EXISTS training_phases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  coach_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,                        -- coach-entered label
  phase_type    TEXT NOT NULL CHECK (phase_type IN ('bulk', 'cut', 'maintenance', 'peak', 'deload', 'custom')),
  date_start    DATE NOT NULL,
  date_end      DATE,                                  -- NULL = ongoing
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE training_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own client phases"
  ON training_phases
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE INDEX idx_training_phases_client ON training_phases(client_id);
CREATE INDEX idx_training_phases_dates  ON training_phases(client_id, date_start, date_end);

-- ─── Metric annotations ───────────────────────────────────────────────────────
-- A point-in-time event pinned on the metrics timeline.
-- Examples: "Changement de programme", "Blessure épaule", "Voyage 2 semaines"

CREATE TABLE IF NOT EXISTS metric_annotations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  coach_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_date    DATE NOT NULL,
  label         TEXT NOT NULL,
  event_type    TEXT NOT NULL CHECK (event_type IN ('program_change', 'injury', 'travel', 'nutrition', 'note')),
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE metric_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own client annotations"
  ON metric_annotations
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE INDEX idx_metric_annotations_client ON metric_annotations(client_id);
CREATE INDEX idx_metric_annotations_date   ON metric_annotations(client_id, event_date);
