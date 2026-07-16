-- Reward delivery modes: digital access or a physical shipment request.

ALTER TABLE coach_rewards
  ADD COLUMN IF NOT EXISTS fulfillment_mode TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS delivery_url TEXT,
  ADD COLUMN IF NOT EXISTS reward_type TEXT NOT NULL DEFAULT 'digital';

ALTER TABLE coach_rewards
  DROP CONSTRAINT IF EXISTS coach_rewards_fulfillment_mode_check;

ALTER TABLE coach_rewards
  ADD CONSTRAINT coach_rewards_fulfillment_mode_check
  CHECK (fulfillment_mode IN ('manual', 'automatic'));

ALTER TABLE coach_rewards
  DROP CONSTRAINT IF EXISTS coach_rewards_reward_type_check;

ALTER TABLE coach_rewards
  ADD CONSTRAINT coach_rewards_reward_type_check
  CHECK (reward_type IN ('digital', 'physical'));

ALTER TABLE client_reward_redemptions
  ADD COLUMN IF NOT EXISTS delivery_url TEXT,
  ADD COLUMN IF NOT EXISTS shipping_recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS shipping_city TEXT,
  ADD COLUMN IF NOT EXISTS shipping_country TEXT,
  ADD COLUMN IF NOT EXISTS shipping_phone TEXT,
  ADD COLUMN IF NOT EXISTS shipping_confirmed_at TIMESTAMPTZ;

ALTER TABLE coach_clients
  ADD COLUMN IF NOT EXISTS shipping_recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS shipping_city TEXT,
  ADD COLUMN IF NOT EXISTS shipping_country TEXT,
  ADD COLUMN IF NOT EXISTS shipping_phone TEXT,
  ADD COLUMN IF NOT EXISTS shipping_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS client_reward_redemptions_active_reward_once_idx
  ON client_reward_redemptions (client_id, reward_id)
  WHERE status IN ('pending', 'fulfilled');

-- Redemptions are written through the server-side exchange flow only. This keeps
-- point debiting, delivery data and the redemption record inseparable.
DROP POLICY IF EXISTS "client_manage_redemptions" ON client_reward_redemptions;
DROP POLICY IF EXISTS "coach_manage_client_redemptions" ON client_reward_redemptions;

CREATE POLICY "client_read_own_reward_redemptions" ON client_reward_redemptions
  FOR SELECT TO authenticated
  USING (client_id IN (
    SELECT id FROM coach_clients WHERE user_id = auth.uid()
  ));

CREATE POLICY "coach_read_client_reward_redemptions" ON client_reward_redemptions
  FOR SELECT TO authenticated
  USING (client_id IN (
    SELECT id FROM coach_clients WHERE coach_id = auth.uid()
  ));

-- Lock the wallet row and create the redemption in one transaction. Physical
-- rewards always remain pending and retain an address snapshot for the coach.
DROP FUNCTION IF EXISTS public.redeem_client_reward(UUID, UUID);

CREATE FUNCTION public.redeem_client_reward(
  p_client_id UUID,
  p_reward_id UUID,
  p_shipping_recipient_name TEXT DEFAULT NULL,
  p_shipping_address_line1 TEXT DEFAULT NULL,
  p_shipping_address_line2 TEXT DEFAULT NULL,
  p_shipping_postal_code TEXT DEFAULT NULL,
  p_shipping_city TEXT DEFAULT NULL,
  p_shipping_country TEXT DEFAULT NULL,
  p_shipping_phone TEXT DEFAULT NULL
)
RETURNS TABLE (
  redemption_id UUID,
  redemption_status TEXT,
  reward_title TEXT,
  reward_cost_points INT,
  reward_type TEXT,
  delivery_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward coach_rewards%ROWTYPE;
  v_streak client_streaks%ROWTYPE;
  v_redemption client_reward_redemptions%ROWTYPE;
BEGIN
  SELECT * INTO v_reward
  FROM coach_rewards
  WHERE id = p_reward_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REWARD_NOT_FOUND';
  END IF;

  IF NOT v_reward.is_active THEN
    RAISE EXCEPTION 'REWARD_NOT_ACTIVE';
  END IF;

  IF v_reward.reward_type = 'physical' AND (
    NULLIF(trim(p_shipping_recipient_name), '') IS NULL OR
    NULLIF(trim(p_shipping_address_line1), '') IS NULL OR
    NULLIF(trim(p_shipping_postal_code), '') IS NULL OR
    NULLIF(trim(p_shipping_city), '') IS NULL OR
    NULLIF(trim(p_shipping_country), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'SHIPPING_ADDRESS_REQUIRED';
  END IF;

  SELECT * INTO v_streak
  FROM client_streaks
  WHERE client_id = p_client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CLIENT_STREAK_NOT_FOUND';
  END IF;

  IF v_streak.total_points - v_streak.spent_points < v_reward.cost_points THEN
    RAISE EXCEPTION 'INSUFFICIENT_POINTS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM client_reward_redemptions
    WHERE client_id = p_client_id
      AND reward_id = p_reward_id
      AND status IN ('pending', 'fulfilled')
  ) THEN
    RAISE EXCEPTION 'REWARD_ALREADY_REDEEMED';
  END IF;

  INSERT INTO client_reward_redemptions (
    client_id,
    reward_id,
    status,
    fulfilled_at,
    delivery_url,
    shipping_recipient_name,
    shipping_address_line1,
    shipping_address_line2,
    shipping_postal_code,
    shipping_city,
    shipping_country,
    shipping_phone,
    shipping_confirmed_at
  )
  VALUES (
    p_client_id,
    p_reward_id,
    CASE WHEN v_reward.reward_type = 'digital' AND v_reward.fulfillment_mode = 'automatic' THEN 'fulfilled' ELSE 'pending' END,
    CASE WHEN v_reward.reward_type = 'digital' AND v_reward.fulfillment_mode = 'automatic' THEN now() ELSE NULL END,
    CASE WHEN v_reward.reward_type = 'digital' AND v_reward.fulfillment_mode = 'automatic' THEN v_reward.delivery_url ELSE NULL END,
    CASE WHEN v_reward.reward_type = 'physical' THEN trim(p_shipping_recipient_name) ELSE NULL END,
    CASE WHEN v_reward.reward_type = 'physical' THEN trim(p_shipping_address_line1) ELSE NULL END,
    CASE WHEN v_reward.reward_type = 'physical' THEN NULLIF(trim(p_shipping_address_line2), '') ELSE NULL END,
    CASE WHEN v_reward.reward_type = 'physical' THEN trim(p_shipping_postal_code) ELSE NULL END,
    CASE WHEN v_reward.reward_type = 'physical' THEN trim(p_shipping_city) ELSE NULL END,
    CASE WHEN v_reward.reward_type = 'physical' THEN trim(p_shipping_country) ELSE NULL END,
    CASE WHEN v_reward.reward_type = 'physical' THEN NULLIF(trim(p_shipping_phone), '') ELSE NULL END,
    CASE WHEN v_reward.reward_type = 'physical' THEN now() ELSE NULL END
  )
  RETURNING * INTO v_redemption;

  IF v_reward.reward_type = 'physical' THEN
    UPDATE coach_clients
    SET
      shipping_recipient_name = trim(p_shipping_recipient_name),
      shipping_address_line1 = trim(p_shipping_address_line1),
      shipping_address_line2 = NULLIF(trim(p_shipping_address_line2), ''),
      shipping_postal_code = trim(p_shipping_postal_code),
      shipping_city = trim(p_shipping_city),
      shipping_country = trim(p_shipping_country),
      shipping_phone = NULLIF(trim(p_shipping_phone), ''),
      shipping_updated_at = now()
    WHERE id = p_client_id;
  END IF;

  UPDATE client_streaks
  SET spent_points = spent_points + v_reward.cost_points
  WHERE client_id = p_client_id;

  RETURN QUERY SELECT
    v_redemption.id,
    v_redemption.status,
    v_reward.title,
    v_reward.cost_points,
    v_reward.reward_type,
    v_redemption.delivery_url;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_client_reward(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_client_reward(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
