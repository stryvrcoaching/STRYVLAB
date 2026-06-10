ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS seen_at timestamptz;

CREATE INDEX IF NOT EXISTS chat_messages_client_unseen_idx
  ON public.chat_messages (client_id, created_at DESC)
  WHERE role = 'assistant' AND archived_at IS NULL AND seen_at IS NULL;
