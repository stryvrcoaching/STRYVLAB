-- Gamification V3: personal progression and coach-specific reward wallets.
--
-- A rank belongs to the client identity and survives a coach change. Reward
-- credit belongs to one coach/client relationship and is never transferred.

CREATE TABLE IF NOT EXISTS public.coach_reward_settings (
  coach_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pace TEXT NOT NULL DEFAULT 'balanced' CHECK (pace IN ('fast', 'balanced', 'demanding')),
  last_pace_change_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coach_reward_pace_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_pace TEXT,
  next_pace TEXT NOT NULL CHECK (next_pace IN ('fast', 'balanced', 'demanding')),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_progression_profiles (
  identity_id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total_points INTEGER NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  level TEXT NOT NULL DEFAULT 'starter' CHECK (level IN ('starter', 'metal', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'olympian')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_progression_profiles_user_id_idx
  ON public.client_progression_profiles(user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.client_reward_wallets (
  client_id UUID NOT NULL REFERENCES public.coach_clients(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_id UUID NOT NULL,
  earned_points INTEGER NOT NULL DEFAULT 0 CHECK (earned_points >= 0),
  spent_points INTEGER NOT NULL DEFAULT 0 CHECK (spent_points >= 0 AND spent_points <= earned_points),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, coach_id)
);

CREATE INDEX IF NOT EXISTS client_reward_wallets_identity_id_idx
  ON public.client_reward_wallets(identity_id);

CREATE TABLE IF NOT EXISTS public.client_progression_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.coach_clients(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('training', 'nutrition', 'checkin', 'checkin_late', 'assessment', 'milestone')),
  base_points INTEGER NOT NULL CHECK (base_points >= 0),
  awarded_points INTEGER NOT NULL CHECK (awarded_points >= 0),
  pace TEXT NOT NULL CHECK (pace IN ('fast', 'balanced', 'demanding')),
  source_key TEXT NOT NULL,
  reference_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, source_key)
);

CREATE INDEX IF NOT EXISTS client_progression_events_identity_occurred_idx
  ON public.client_progression_events(identity_id, occurred_at DESC);

ALTER TABLE public.coach_reward_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_reward_pace_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_progression_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_reward_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_progression_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_manage_reward_settings" ON public.coach_reward_settings
  FOR ALL TO authenticated
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

CREATE POLICY "coach_read_reward_pace_changes" ON public.coach_reward_pace_changes
  FOR SELECT TO authenticated USING (coach_id = auth.uid());

CREATE POLICY "client_read_own_progression" ON public.client_progression_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "client_read_own_reward_wallet" ON public.client_reward_wallets
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.coach_clients WHERE user_id = auth.uid()));

CREATE POLICY "coach_read_reward_wallets" ON public.client_reward_wallets
  FOR SELECT TO authenticated USING (coach_id = auth.uid());

CREATE POLICY "client_read_own_progression_events" ON public.client_progression_events
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.coach_clients WHERE user_id = auth.uid()));

CREATE POLICY "coach_read_progression_events" ON public.client_progression_events
  FOR SELECT TO authenticated USING (coach_id = auth.uid());

CREATE OR REPLACE FUNCTION public.gamification_level_for_points(p_points INTEGER)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_points >= 6500 THEN 'olympian'
    WHEN p_points >= 4500 THEN 'master'
    WHEN p_points >= 3000 THEN 'diamond'
    WHEN p_points >= 1500 THEN 'platinum'
    WHEN p_points >= 700 THEN 'gold'
    WHEN p_points >= 350 THEN 'silver'
    WHEN p_points >= 150 THEN 'bronze'
    WHEN p_points >= 25 THEN 'metal'
    ELSE 'starter'
  END;
$$;

-- A first login may link an existing client row to auth.users. Preserve the
-- progression snapshot created before that link, instead of starting over.
CREATE OR REPLACE FUNCTION public.sync_progression_identity_on_client_link()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_previous public.client_progression_profiles%ROWTYPE; v_current public.client_progression_profiles%ROWTYPE; BEGIN
  IF OLD.user_id IS NOT NULL OR NEW.user_id IS NULL OR OLD.user_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT * INTO v_previous FROM public.client_progression_profiles WHERE identity_id = NEW.id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT * INTO v_current FROM public.client_progression_profiles WHERE identity_id = NEW.user_id FOR UPDATE;
  IF FOUND THEN
    UPDATE public.client_progression_profiles
      SET total_points = v_current.total_points + v_previous.total_points,
          level = public.gamification_level_for_points(v_current.total_points + v_previous.total_points),
          updated_at = now()
      WHERE identity_id = NEW.user_id;
    DELETE FROM public.client_progression_profiles WHERE identity_id = NEW.id;
  ELSE
    UPDATE public.client_progression_profiles SET identity_id = NEW.user_id, user_id = NEW.user_id, updated_at = now()
      WHERE identity_id = NEW.id;
  END IF;
  UPDATE public.client_reward_wallets SET identity_id = NEW.user_id, updated_at = now() WHERE client_id = NEW.id;
  UPDATE public.client_progression_events SET identity_id = NEW.user_id WHERE client_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coach_clients_sync_progression_identity ON public.coach_clients;
CREATE TRIGGER coach_clients_sync_progression_identity
  AFTER UPDATE OF user_id ON public.coach_clients
  FOR EACH ROW EXECUTE FUNCTION public.sync_progression_identity_on_client_link();

CREATE OR REPLACE FUNCTION public.award_client_progression(
  p_client_id UUID,
  p_action_type TEXT,
  p_base_points INTEGER,
  p_source_key TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_occurred_at TIMESTAMPTZ DEFAULT now(),
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  awarded_points INTEGER,
  total_points INTEGER,
  level TEXT,
  wallet_points INTEGER,
  already_awarded BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client public.coach_clients%ROWTYPE;
  v_identity_id UUID;
  v_pace TEXT;
  v_awarded_points INTEGER;
  v_profile public.client_progression_profiles%ROWTYPE;
  v_wallet public.client_reward_wallets%ROWTYPE;
BEGIN
  IF p_base_points < 0 OR NULLIF(trim(p_source_key), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_PROGRESSION_AWARD';
  END IF;

  SELECT * INTO v_client FROM public.coach_clients WHERE id = p_client_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLIENT_NOT_FOUND'; END IF;

  v_identity_id := COALESCE(v_client.user_id, v_client.id);
  SELECT pace INTO v_pace FROM public.coach_reward_settings WHERE coach_id = v_client.coach_id;
  v_pace := COALESCE(v_pace, 'balanced');
  v_awarded_points := GREATEST(0, ROUND(p_base_points * CASE v_pace
    WHEN 'fast' THEN 1.15
    WHEN 'demanding' THEN 0.85
    ELSE 1.00
  END));

  INSERT INTO public.client_progression_events (
    identity_id, client_id, coach_id, action_type, base_points, awarded_points,
    pace, source_key, reference_id, occurred_at, metadata
  ) VALUES (
    v_identity_id, v_client.id, v_client.coach_id, p_action_type, p_base_points,
    v_awarded_points, v_pace, p_source_key, p_reference_id, p_occurred_at, COALESCE(p_metadata, '{}'::jsonb)
  ) ON CONFLICT (client_id, source_key) DO NOTHING;

  IF NOT FOUND THEN
    SELECT p.awarded_points, pr.total_points, pr.level, w.earned_points - w.spent_points
      INTO awarded_points, total_points, level, wallet_points
    FROM public.client_progression_events p
    JOIN public.client_progression_profiles pr ON pr.identity_id = p.identity_id
    JOIN public.client_reward_wallets w ON w.client_id = p.client_id AND w.coach_id = p.coach_id
    WHERE p.client_id = p_client_id AND p.source_key = p_source_key;
    already_awarded := TRUE;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.client_progression_profiles (identity_id, user_id, total_points, level)
  VALUES (v_identity_id, v_client.user_id, v_awarded_points, public.gamification_level_for_points(v_awarded_points))
  ON CONFLICT (identity_id) DO UPDATE SET
    user_id = COALESCE(EXCLUDED.user_id, public.client_progression_profiles.user_id),
    total_points = public.client_progression_profiles.total_points + v_awarded_points,
    level = public.gamification_level_for_points(public.client_progression_profiles.total_points + v_awarded_points),
    updated_at = now()
  RETURNING * INTO v_profile;

  INSERT INTO public.client_reward_wallets (client_id, coach_id, identity_id, earned_points)
  VALUES (v_client.id, v_client.coach_id, v_identity_id, v_awarded_points)
  ON CONFLICT (client_id, coach_id) DO UPDATE SET
    earned_points = public.client_reward_wallets.earned_points + v_awarded_points,
    updated_at = now()
  RETURNING * INTO v_wallet;

  awarded_points := v_awarded_points;
  total_points := v_profile.total_points;
  level := v_profile.level;
  wallet_points := v_wallet.earned_points - v_wallet.spent_points;
  already_awarded := FALSE;
  RETURN NEXT;
END;
$$;

-- Preserve the existing balance for active client relationships on rollout.
INSERT INTO public.client_progression_profiles (identity_id, user_id, total_points, level)
SELECT COALESCE(c.user_id, c.id), c.user_id, GREATEST(0, COALESCE(s.total_points, 0)),
       public.gamification_level_for_points(GREATEST(0, COALESCE(s.total_points, 0)))
FROM public.coach_clients c
LEFT JOIN public.client_streaks s ON s.client_id = c.id
ON CONFLICT (identity_id) DO NOTHING;

INSERT INTO public.client_reward_wallets (client_id, coach_id, identity_id, earned_points, spent_points)
SELECT c.id, c.coach_id, COALESCE(c.user_id, c.id),
       GREATEST(0, COALESCE(s.total_points, 0)),
       LEAST(GREATEST(0, COALESCE(s.spent_points, 0)), GREATEST(0, COALESCE(s.total_points, 0)))
FROM public.coach_clients c
LEFT JOIN public.client_streaks s ON s.client_id = c.id
ON CONFLICT (client_id, coach_id) DO NOTHING;

-- Replace the V2 exchange with a wallet scoped to the current coach relationship.
CREATE OR REPLACE FUNCTION public.redeem_client_reward(
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
RETURNS TABLE (redemption_id UUID, redemption_status TEXT, reward_title TEXT, reward_cost_points INT, reward_type TEXT, delivery_url TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client public.coach_clients%ROWTYPE;
  v_reward public.coach_rewards%ROWTYPE;
  v_wallet public.client_reward_wallets%ROWTYPE;
  v_status TEXT;
  v_redemption_id UUID;
BEGIN
  SELECT * INTO v_client FROM public.coach_clients WHERE id = p_client_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLIENT_NOT_FOUND'; END IF;
  SELECT * INTO v_reward FROM public.coach_rewards WHERE id = p_reward_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REWARD_NOT_FOUND'; END IF;
  IF v_reward.coach_id <> v_client.coach_id THEN RAISE EXCEPTION 'REWARD_COACH_MISMATCH'; END IF;
  IF NOT v_reward.is_active THEN RAISE EXCEPTION 'REWARD_NOT_ACTIVE'; END IF;
  IF v_reward.reward_type = 'physical' AND (
    NULLIF(trim(p_shipping_recipient_name), '') IS NULL OR NULLIF(trim(p_shipping_address_line1), '') IS NULL OR
    NULLIF(trim(p_shipping_postal_code), '') IS NULL OR NULLIF(trim(p_shipping_city), '') IS NULL OR NULLIF(trim(p_shipping_country), '') IS NULL
  ) THEN RAISE EXCEPTION 'SHIPPING_ADDRESS_REQUIRED'; END IF;

  SELECT * INTO v_wallet FROM public.client_reward_wallets
    WHERE client_id = v_client.id AND coach_id = v_client.coach_id FOR UPDATE;
  IF NOT FOUND OR v_wallet.earned_points - v_wallet.spent_points < v_reward.cost_points THEN
    RAISE EXCEPTION 'INSUFFICIENT_POINTS';
  END IF;

  v_status := CASE WHEN v_reward.fulfillment_mode = 'automatic' AND v_reward.reward_type = 'digital' THEN 'fulfilled' ELSE 'pending' END;
  UPDATE public.client_reward_wallets SET spent_points = spent_points + v_reward.cost_points, updated_at = now()
    WHERE client_id = v_client.id AND coach_id = v_client.coach_id;
  INSERT INTO public.client_reward_redemptions (
    client_id, reward_id, status, fulfilled_at, delivery_url, shipping_recipient_name, shipping_address_line1,
    shipping_address_line2, shipping_postal_code, shipping_city, shipping_country, shipping_phone, shipping_confirmed_at
  ) VALUES (
    v_client.id, v_reward.id, v_status, CASE WHEN v_status = 'fulfilled' THEN now() ELSE NULL END,
    CASE WHEN v_status = 'fulfilled' THEN v_reward.delivery_url ELSE NULL END, p_shipping_recipient_name, p_shipping_address_line1,
    NULLIF(p_shipping_address_line2, ''), p_shipping_postal_code, p_shipping_city, p_shipping_country, NULLIF(p_shipping_phone, ''),
    CASE WHEN v_reward.reward_type = 'physical' THEN now() ELSE NULL END
  ) RETURNING id INTO v_redemption_id;
  RETURN QUERY SELECT v_redemption_id, v_status, v_reward.title, v_reward.cost_points, v_reward.reward_type,
    CASE WHEN v_status = 'fulfilled' THEN v_reward.delivery_url ELSE NULL END;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_client_reward_redemption(p_redemption_id UUID, p_client_id UUID, p_coach_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_redemption public.client_reward_redemptions%ROWTYPE; v_cost INTEGER; BEGIN
  SELECT * INTO v_redemption FROM public.client_reward_redemptions
    WHERE id = p_redemption_id AND client_id = p_client_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT cost_points INTO v_cost FROM public.coach_rewards WHERE id = v_redemption.reward_id AND coach_id = p_coach_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE public.client_reward_wallets SET spent_points = GREATEST(0, spent_points - v_cost), updated_at = now()
    WHERE client_id = p_client_id AND coach_id = p_coach_id;
  UPDATE public.client_reward_redemptions SET status = 'cancelled' WHERE id = p_redemption_id;
  RETURN TRUE;
END;
$$;

NOTIFY pgrst, 'reload schema';
