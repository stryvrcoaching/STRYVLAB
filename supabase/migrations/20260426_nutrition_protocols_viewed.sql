-- Add viewed_by_client_at timestamp to nutrition_protocols
-- Tracks when client first viewed a shared protocol
-- NULL = client hasn't viewed yet (use this for "New" badge)

ALTER TABLE nutrition_protocols
ADD COLUMN IF NOT EXISTS viewed_by_client_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for fetching unviewed shared protocols
CREATE INDEX IF NOT EXISTS idx_nutrition_protocols_unviewed
  ON nutrition_protocols(client_id)
  WHERE status = 'shared' AND viewed_by_client_at IS NULL;

-- Comment for documentation
COMMENT ON COLUMN nutrition_protocols.viewed_by_client_at IS
  'Timestamp when client first viewed this shared protocol. NULL = not yet viewed (show badge).';
