-- Sales workspace: a dedicated application surface for STRYV commercial partners.
-- It intentionally does not grant access to coach, client, or internal dashboard data.

CREATE TABLE IF NOT EXISTS public.sales_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sales_partners_email_unique_idx
  ON public.sales_partners (lower(email));

CREATE TABLE IF NOT EXISTS public.sales_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_partner_id uuid NOT NULL REFERENCES public.sales_partners(id) ON DELETE RESTRICT,
  closing_partner_id uuid REFERENCES public.sales_partners(id) ON DELETE SET NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  normalized_email text NOT NULL,
  company_name text,
  phone text,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'referral_link', 'event', 'network', 'other')),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'demo_scheduled', 'trialing', 'active', 'lost', 'archived')),
  notes text,
  next_follow_up_at timestamptz,
  demo_scheduled_at timestamptz,
  coach_id uuid REFERENCES public.coach_profiles(coach_id) ON DELETE SET NULL,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_leads_normalized_email_check
    CHECK (normalized_email = lower(trim(email)))
);

ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS closing_partner_id uuid REFERENCES public.sales_partners(id) ON DELETE SET NULL;

-- A prospect is attributed to exactly one commercial partner. Reassignment is
-- performed from the STRYV back-office through a controlled operation, not by a partner.
CREATE UNIQUE INDEX IF NOT EXISTS sales_leads_normalized_email_unique_idx
  ON public.sales_leads (normalized_email);

CREATE INDEX IF NOT EXISTS sales_leads_partner_status_idx
  ON public.sales_leads (sales_partner_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS sales_leads_closing_partner_status_idx
  ON public.sales_leads (closing_partner_id, status, created_at DESC)
  WHERE closing_partner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sales_leads_partner_follow_up_idx
  ON public.sales_leads (sales_partner_id, next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.sales_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_partner_id uuid NOT NULL REFERENCES public.sales_partners(id) ON DELETE RESTRICT,
  lead_id uuid REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'task'
    CHECK (kind IN ('task', 'note', 'meeting', 'call')),
  title text NOT NULL,
  details text,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_activities_partner_due_idx
  ON public.sales_activities (sales_partner_id, due_at)
  WHERE completed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.sales_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_partner_id uuid NOT NULL REFERENCES public.sales_partners(id) ON DELETE RESTRICT,
  lead_id uuid REFERENCES public.sales_leads(id) ON DELETE SET NULL,
  coach_id uuid REFERENCES public.coach_profiles(coach_id) ON DELETE SET NULL,
  coach_plan text NOT NULL CHECK (coach_plan IN ('solo', 'pro', 'studio')),
  commission_kind text NOT NULL CHECK (commission_kind IN ('referral', 'closing_bonus')),
  amount_eur numeric(10,2) NOT NULL CHECK (amount_eur >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  description text NOT NULL,
  source_invoice_id text,
  eligible_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_commissions
  ADD COLUMN IF NOT EXISTS coach_plan text NOT NULL DEFAULT 'pro',
  ADD COLUMN IF NOT EXISTS commission_kind text NOT NULL DEFAULT 'referral',
  ADD COLUMN IF NOT EXISTS source_invoice_id text;

ALTER TABLE public.sales_commissions
  DROP CONSTRAINT IF EXISTS sales_commissions_coach_plan_check,
  ADD CONSTRAINT sales_commissions_coach_plan_check
    CHECK (coach_plan IN ('solo', 'pro', 'studio')),
  DROP CONSTRAINT IF EXISTS sales_commissions_commission_kind_check,
  ADD CONSTRAINT sales_commissions_commission_kind_check
    CHECK (commission_kind IN ('referral', 'closing_bonus'));

ALTER TABLE public.sales_commissions
  ALTER COLUMN coach_plan DROP DEFAULT,
  ALTER COLUMN commission_kind DROP DEFAULT;

CREATE INDEX IF NOT EXISTS sales_commissions_partner_status_idx
  ON public.sales_commissions (sales_partner_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS sales_commissions_invoice_kind_unique_idx
  ON public.sales_commissions (source_invoice_id, commission_kind)
  WHERE source_invoice_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.sales_commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_plan text NOT NULL CHECK (coach_plan IN ('solo', 'pro', 'studio')),
  referral_amount_eur numeric(10,2) NOT NULL CHECK (referral_amount_eur >= 0),
  full_sale_total_amount_eur numeric(10,2) NOT NULL CHECK (full_sale_total_amount_eur >= referral_amount_eur),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_plan)
);

INSERT INTO public.sales_commission_rules (
  coach_plan,
  referral_amount_eur,
  full_sale_total_amount_eur
)
VALUES
  ('solo', 10.00, 15.00),
  ('pro', 25.00, 79.00),
  ('studio', 40.00, 129.00)
ON CONFLICT (coach_plan) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sales_workspace_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_partners_set_updated_at ON public.sales_partners;
CREATE TRIGGER sales_partners_set_updated_at
  BEFORE UPDATE ON public.sales_partners
  FOR EACH ROW EXECUTE FUNCTION public.sales_workspace_set_updated_at();

DROP TRIGGER IF EXISTS sales_leads_set_updated_at ON public.sales_leads;
CREATE TRIGGER sales_leads_set_updated_at
  BEFORE UPDATE ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.sales_workspace_set_updated_at();

DROP TRIGGER IF EXISTS sales_activities_set_updated_at ON public.sales_activities;
CREATE TRIGGER sales_activities_set_updated_at
  BEFORE UPDATE ON public.sales_activities
  FOR EACH ROW EXECUTE FUNCTION public.sales_workspace_set_updated_at();

DROP TRIGGER IF EXISTS sales_commissions_set_updated_at ON public.sales_commissions;
CREATE TRIGGER sales_commissions_set_updated_at
  BEFORE UPDATE ON public.sales_commissions
  FOR EACH ROW EXECUTE FUNCTION public.sales_workspace_set_updated_at();

DROP TRIGGER IF EXISTS sales_commission_rules_set_updated_at ON public.sales_commission_rules;
CREATE TRIGGER sales_commission_rules_set_updated_at
  BEFORE UPDATE ON public.sales_commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.sales_workspace_set_updated_at();

ALTER TABLE public.sales_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_commission_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_partners_read_own" ON public.sales_partners;
DROP POLICY IF EXISTS "sales_leads_read_own" ON public.sales_leads;
DROP POLICY IF EXISTS "sales_leads_create_own" ON public.sales_leads;
DROP POLICY IF EXISTS "sales_leads_update_own" ON public.sales_leads;
DROP POLICY IF EXISTS "sales_activities_read_own" ON public.sales_activities;
DROP POLICY IF EXISTS "sales_activities_create_own" ON public.sales_activities;
DROP POLICY IF EXISTS "sales_activities_update_own" ON public.sales_activities;
DROP POLICY IF EXISTS "sales_commissions_read_own" ON public.sales_commissions;
DROP POLICY IF EXISTS "sales_commission_rules_read_active" ON public.sales_commission_rules;

CREATE POLICY "sales_partners_read_own"
  ON public.sales_partners FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "sales_leads_read_own"
  ON public.sales_leads FOR SELECT
  USING (
    sales_partner_id IN (
      SELECT id FROM public.sales_partners WHERE user_id = auth.uid() AND status = 'active'
    )
    OR closing_partner_id IN (
      SELECT id FROM public.sales_partners WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "sales_activities_read_own"
  ON public.sales_activities FOR SELECT
  USING (
    sales_partner_id IN (
      SELECT id FROM public.sales_partners WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "sales_commissions_read_own"
  ON public.sales_commissions FOR SELECT
  USING (
    sales_partner_id IN (
      SELECT id FROM public.sales_partners WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "sales_commission_rules_read_active"
  ON public.sales_commission_rules FOR SELECT
  USING (is_active = true);
