-- chat_messages + chat_sessions — Sub-projet #1 Chat-First Client App

CREATE TABLE IF NOT EXISTS chat_messages (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('user', 'assistant')),
  content       text NOT NULL,
  message_type  text NOT NULL DEFAULT 'text'
                CHECK (message_type IN ('text', 'quick_reply', 'slider', 'voice')),
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  archived_at   timestamptz
);

CREATE INDEX IF NOT EXISTS chat_messages_client_created_idx
  ON chat_messages (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_client_archived_idx
  ON chat_messages (client_id, archived_at);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_client_own" ON chat_messages
  FOR ALL USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "chat_messages_coach_read" ON chat_messages
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE coach_id = auth.uid()
    )
  );

-- Sessions de check-in / chat journalier
CREATE TABLE IF NOT EXISTS chat_sessions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  date          date NOT NULL,
  flow_type     text NOT NULL CHECK (flow_type IN ('morning', 'evening', 'freeform')),
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, date, flow_type)
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_sessions_client_own" ON chat_sessions
  FOR ALL USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "chat_sessions_coach_read" ON chat_sessions
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE coach_id = auth.uid()
    )
  );
