-- Gamification V2: New levels, streak bonuses, quest rewards, and coach rewards store

-- 1. Modify constraints on client_streaks (level) and client_points (action_type)
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'client_streaks'::regclass AND contype = 'c' AND conname LIKE '%level%';
  IF con_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE client_streaks DROP CONSTRAINT ' || con_name;
  END IF;

  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'client_points'::regclass AND contype = 'c' AND conname LIKE '%action_type%';
  IF con_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE client_points DROP CONSTRAINT ' || con_name;
  END IF;
END $$;

ALTER TABLE client_streaks
  ADD CONSTRAINT client_streaks_level_check CHECK (level IN ('iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'olympian'));

ALTER TABLE client_points
  ADD CONSTRAINT client_points_action_type_check CHECK (action_type IN ('checkin', 'checkin_late', 'session', 'bilan', 'meal', 'streak_bonus', 'quest_reward'));

-- 2. Add spent_points to client_streaks
ALTER TABLE client_streaks ADD COLUMN IF NOT EXISTS spent_points INT NOT NULL DEFAULT 0;

-- 3. Create coach_rewards table
CREATE TABLE IF NOT EXISTS coach_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cost_points INT NOT NULL CHECK (cost_points >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_rewards_coach_id_idx ON coach_rewards(coach_id);

-- 4. Create client_reward_redemptions table
CREATE TABLE IF NOT EXISTS client_reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES coach_rewards(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'fulfilled', 'cancelled')) DEFAULT 'pending',
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS client_reward_redemptions_client_id_idx ON client_reward_redemptions(client_id);
CREATE INDEX IF NOT EXISTS client_reward_redemptions_reward_id_idx ON client_reward_redemptions(reward_id);

-- 5. Set up updated_at triggers
CREATE OR REPLACE FUNCTION set_coach_rewards_updated_at()
RETURNS TRIGGER AS $func$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_coach_rewards_updated_at ON coach_rewards;
CREATE TRIGGER trg_coach_rewards_updated_at
  BEFORE UPDATE ON coach_rewards
  FOR EACH ROW EXECUTE FUNCTION set_coach_rewards_updated_at();

-- 6. Enable RLS
ALTER TABLE coach_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_reward_redemptions ENABLE ROW LEVEL SECURITY;

-- coach_rewards policies
CREATE POLICY "coach_manage_rewards" ON coach_rewards
  FOR ALL TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "client_read_rewards" ON coach_rewards
  FOR SELECT TO authenticated
  USING (
    coach_id IN (
      SELECT coach_id FROM coach_clients WHERE user_id = auth.uid()
    )
  );

-- client_reward_redemptions policies
CREATE POLICY "client_manage_redemptions" ON client_reward_redemptions
  FOR ALL TO authenticated
  USING (client_id IN (
    SELECT id FROM coach_clients WHERE user_id = auth.uid()
  ))
  WITH CHECK (client_id IN (
    SELECT id FROM coach_clients WHERE user_id = auth.uid()
  ));

CREATE POLICY "coach_manage_client_redemptions" ON client_reward_redemptions
  FOR ALL TO authenticated
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE coach_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM coach_clients WHERE coach_id = auth.uid()
    )
  );

