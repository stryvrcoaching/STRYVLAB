-- ─── Organisation — Kanban & Agenda ──────────────────────────────────────────
-- Coach-scoped kanban boards, columns, tasks, and agenda events.
-- All tables use auth.uid() = coach_id for RLS.

-- ─── Kanban boards ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kanban_boards (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Tableau principal',
  "order"    INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE kanban_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own kanban boards"
  ON kanban_boards FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE INDEX idx_kanban_boards_coach ON kanban_boards(coach_id);

-- ─── Kanban columns ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kanban_columns (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  board_id   UUID NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  "order"    INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE kanban_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own kanban columns"
  ON kanban_columns FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE INDEX idx_kanban_columns_board ON kanban_columns(board_id);

-- ─── Kanban tasks ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kanban_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  board_id    UUID NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
  column_id   UUID NOT NULL REFERENCES kanban_columns(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  due_date    DATE,
  priority    TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  "order"     INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE kanban_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own kanban tasks"
  ON kanban_tasks FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE INDEX idx_kanban_tasks_board  ON kanban_tasks(board_id);
CREATE INDEX idx_kanban_tasks_column ON kanban_tasks(column_id);

-- ─── Agenda events ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agenda_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  event_date  DATE NOT NULL,
  event_time  TIME,
  description TEXT,
  priority    TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE agenda_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own agenda events"
  ON agenda_events FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE INDEX idx_agenda_events_coach ON agenda_events(coach_id);
CREATE INDEX idx_agenda_events_date  ON agenda_events(coach_id, event_date);
