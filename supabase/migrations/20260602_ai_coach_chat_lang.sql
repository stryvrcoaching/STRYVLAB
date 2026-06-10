ALTER TABLE coach_ai_settings_per_client
  ADD COLUMN IF NOT EXISTS ai_chat_lang text NULL
  CHECK (ai_chat_lang IN ('fr', 'es', 'en'));

COMMENT ON COLUMN coach_ai_settings_per_client.ai_chat_lang IS
  'Language for AI chat responses. NULL = inherit from client display_lang preference.';
