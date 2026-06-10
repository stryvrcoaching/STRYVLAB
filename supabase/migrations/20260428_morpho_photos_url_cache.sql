-- Cache signed URLs on morpho_photos to avoid regenerating them on every page load
-- TTL: 23h (generated with 24h expiry, 1h safety margin)

ALTER TABLE morpho_photos
  ADD COLUMN IF NOT EXISTS signed_url_cache text,
  ADD COLUMN IF NOT EXISTS signed_url_expires_at timestamptz;

-- Index for quickly finding expired/missing URLs per client
CREATE INDEX IF NOT EXISTS idx_morpho_photos_url_cache
  ON morpho_photos (client_id, signed_url_expires_at)
  WHERE signed_url_cache IS NOT NULL;
