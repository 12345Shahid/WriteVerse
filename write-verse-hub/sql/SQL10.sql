-- 1. Create Organization Credits Table
CREATE TABLE IF NOT EXISTS public.organization_credits (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  balance_credits bigint NOT NULL DEFAULT 0,
  meter_usd numeric(12,4) NOT NULL DEFAULT 0, -- Tracks fractional spend
  total_spent_usd numeric(12,4) NOT NULL DEFAULT 0,
  total_deducted_credits bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Usage Events (Detailed Logging)
CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id), -- Who performed the action
  tool text,         -- e.g., 'blog_post', 'email_writer'
  provider text,     -- e.g., 'openai', 'anthropic'
  action text,       -- e.g., 'generate', 'edit'
  units numeric,     -- e.g., token count or words
  cost_usd numeric(12,4) NOT NULL DEFAULT 0,
  credits integer,   -- Credits deducted for this specific event
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_org ON public.usage_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON public.usage_events(created_at);

-- 3. Credit Deductions Log (Audit Trail)
CREATE TABLE IF NOT EXISTS public.credit_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount_credits integer NOT NULL, -- Negative for top-ups, Positive for usage
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Trigger to Initialize Credits on Org Creation
CREATE OR REPLACE FUNCTION public.init_org_credits()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.organization_credits (organization_id, balance_credits)
  VALUES (NEW.id, 100) -- Start with 100 free credits
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_org_created_credits ON public.organizations;
CREATE TRIGGER on_org_created_credits
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.init_org_credits();

-- 5. Usage Recording Function
CREATE OR REPLACE FUNCTION public.record_usage(
  p_organization_id uuid,
  p_user_id uuid,
  p_tool text,
  p_provider text,
  p_action text,
  p_units numeric, -- e.g., tokens used
  p_credits integer, -- How many credits to charge
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  organization_id uuid,
  balance_credits bigint
) AS $$
DECLARE 
  v_org_credits public.organization_credits; 
BEGIN
  -- 1. Ensure credit row exists (Idempotent)
  INSERT INTO public.organization_credits(organization_id) 
  VALUES (p_organization_id)
  ON CONFLICT (organization_id) DO NOTHING;

  -- 2. Log Usage
  INSERT INTO public.usage_events(organization_id, user_id, tool, provider, action, units, cost_usd, credits, metadata)
  VALUES (p_organization_id, p_user_id, p_tool, p_provider, p_action, p_units, 0, p_credits, p_metadata);

  -- 3. Deduct Credits
  UPDATE public.organization_credits
  SET balance_credits = balance_credits - COALESCE(p_credits, 0),
      total_deducted_credits = total_deducted_credits + COALESCE(p_credits, 0),
      updated_at = now()
  WHERE organization_id = p_organization_id;

  -- 4. Log Deduction
  INSERT INTO public.credit_deductions(organization_id, amount_credits, reason)
  VALUES (p_organization_id, p_credits, CONCAT('Usage: ', p_tool));

  -- 5. Return new balance
  SELECT * INTO v_org_credits FROM public.organization_credits WHERE organization_id = p_organization_id;
  RETURN QUERY SELECT v_org_credits.organization_id, v_org_credits.balance_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Brand Kits (New Feature)
CREATE TABLE IF NOT EXISTS public.brand_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default Brand',
  logo_url text,
  primary_color text,
  secondary_color text,
  font_family text,
  tone_of_voice text, -- Specific to WriterAI
  website_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- RLS for Brand Kits
ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view brand kits" ON public.brand_kits
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "Admins can manage brand kits" ON public.brand_kits
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id));

-- 7. Migration Strategy (Moving Users to Orgs)
DO $$
DECLARE
  r RECORD;
  v_org_id uuid;
BEGIN
  FOR r IN SELECT * FROM public.users WHERE credits_balance > 0 LOOP
    -- Find their personal organization (Owner role)
    SELECT organization_id INTO v_org_id
    FROM public.organization_members
    WHERE user_id = r.id AND role = 'owner'
    LIMIT 1;

    IF v_org_id IS NOT NULL THEN
      -- Initialize Organization Credits with User's Balance
      INSERT INTO public.organization_credits (organization_id, balance_credits)
      VALUES (v_org_id, r.credits_balance)
      ON CONFLICT (organization_id) 
      DO UPDATE SET balance_credits = public.organization_credits.balance_credits + r.credits_balance;

      -- Optional: Zero out user credits to avoid double spending
      -- UPDATE public.users SET credits_balance = 0 WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
