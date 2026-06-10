-- supabase/migrations/20260517_coach_client_notifications.sql
CREATE TABLE IF NOT EXISTS coach_client_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES auth.users(id),
  type text NOT NULL CHECK (type IN ('coach_note', 'bilan_pending', 'program_assigned', 'system_reminder')),
  title text NOT NULL,
  body text,
  payload jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_client_active
  ON coach_client_notifications (client_id, dismissed_at, created_at DESC);

ALTER TABLE coach_client_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_client_select ON coach_client_notifications;
CREATE POLICY notif_client_select ON coach_client_notifications
  FOR SELECT USING (
    client_id IN (SELECT id FROM coach_clients WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS notif_client_update ON coach_client_notifications;
CREATE POLICY notif_client_update ON coach_client_notifications
  FOR UPDATE USING (
    client_id IN (SELECT id FROM coach_clients WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS notif_coach_insert ON coach_client_notifications;
CREATE POLICY notif_coach_insert ON coach_client_notifications
  FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM coach_clients WHERE coach_id = auth.uid())
  );
