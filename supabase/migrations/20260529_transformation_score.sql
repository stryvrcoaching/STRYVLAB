ALTER TABLE coach_clients
  ADD COLUMN IF NOT EXISTS score_weights_config JSONB DEFAULT NULL;

COMMENT ON COLUMN coach_clients.score_weights_config IS
  'Coach override for transformation score dimension weights. Shape: {"adherence":0.3,"recovery":0.25,"bodyProgress":0.3,"performance":0.15}. NULL = use training_goal defaults.';
