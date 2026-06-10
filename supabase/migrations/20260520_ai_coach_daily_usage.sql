CREATE TABLE IF NOT EXISTS ai_coach_daily_usage (
  client_id     uuid    NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  date          date    NOT NULL,
  message_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (client_id, date)
);

-- RLS: client peut lire sa propre ligne (pour afficher le compteur)
ALTER TABLE ai_coach_daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_read_own_usage"
  ON ai_coach_daily_usage FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );

-- Pas de politique INSERT/UPDATE pour le client — service role uniquement
