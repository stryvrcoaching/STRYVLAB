-- ─── Kanban ↔ Agenda Bi-directional Sync ──────────────────────────────────────
-- Adds linked IDs, is_completed, and enriched event fields.
-- Apply via Supabase SQL Editor.

-- ─── kanban_tasks additions ────────────────────────────────────────────────────

ALTER TABLE kanban_tasks
  ADD COLUMN IF NOT EXISTS linked_event_id UUID REFERENCES agenda_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_completed    BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_kanban_tasks_linked_event
  ON kanban_tasks(linked_event_id)
  WHERE linked_event_id IS NOT NULL;

-- ─── agenda_events additions ───────────────────────────────────────────────────

ALTER TABLE agenda_events
  ADD COLUMN IF NOT EXISTS linked_task_id          UUID REFERENCES kanban_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_column_title     TEXT,
  ADD COLUMN IF NOT EXISTS event_time_end          TIME,
  ADD COLUMN IF NOT EXISTS client_id               UUID,
  ADD COLUMN IF NOT EXISTS template_type           TEXT,
  ADD COLUMN IF NOT EXISTS is_completed            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notify_minutes_before   INT;

CREATE INDEX IF NOT EXISTS idx_agenda_events_linked_task
  ON agenda_events(linked_task_id)
  WHERE linked_task_id IS NOT NULL;

-- ─── Trigger: task column move → update linked event tag ─────────────────────
-- When a task is moved to a different column, the linked agenda event's
-- linked_column_title is updated automatically at the DB level.
-- This fires even for drag-and-drop PATCHes so no extra app logic is needed.

CREATE OR REPLACE FUNCTION sync_task_column_to_event()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_col_title TEXT;
BEGIN
  IF NEW.column_id IS DISTINCT FROM OLD.column_id AND NEW.linked_event_id IS NOT NULL THEN
    SELECT title INTO v_col_title FROM kanban_columns WHERE id = NEW.column_id;
    UPDATE agenda_events
      SET linked_column_title = v_col_title
      WHERE id = NEW.linked_event_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_column_sync ON kanban_tasks;
CREATE TRIGGER trg_task_column_sync
  AFTER UPDATE OF column_id ON kanban_tasks
  FOR EACH ROW EXECUTE FUNCTION sync_task_column_to_event();

-- ─── Trigger: column rename → update linked_column_title on all linked events ─
-- When a column is renamed, all tasks in that column that have linked events
-- are updated with the new column title automatically.

CREATE OR REPLACE FUNCTION sync_column_rename_to_events()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.title IS DISTINCT FROM OLD.title THEN
    UPDATE agenda_events ae
      SET linked_column_title = NEW.title
      FROM kanban_tasks kt
      WHERE kt.column_id = NEW.id
        AND kt.linked_event_id = ae.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_column_rename_sync ON kanban_columns;
CREATE TRIGGER trg_column_rename_sync
  AFTER UPDATE OF title ON kanban_columns
  FOR EACH ROW EXECUTE FUNCTION sync_column_rename_to_events();
