CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL, -- e.g. 'pro', 'business', 'agency'
  name text NOT NULL,
  description text,
  monthly_price_cents integer NOT NULL,
  yearly_price_cents integer,
  included_credits_per_month integer NOT NULL,
  seat_limit integer NOT NULL,
  stripe_monthly_price_id text,
  stripe_yearly_price_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active subscription plans" ON public.subscription_plans
  FOR SELECT USING (is_active = true);

INSERT INTO public.subscription_plans (code, name, description, monthly_price_cents, yearly_price_cents, included_credits_per_month, seat_limit, is_active)
VALUES
  ('pro', 'Pro', 'For small teams getting started with WriterVerse Hub', 4900, 42000, 50000, 5, true),
  ('business', 'Business', 'For growing teams that need analytics and integrations', 14900, 144000, 200000, 15, true),
  ('agency', 'Agency', 'For larger organizations and agencies with higher volume needs', 29900, 288000, 500000, 30, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  yearly_price_cents = EXCLUDED.yearly_price_cents,
  included_credits_per_month = EXCLUDED.included_credits_per_month,
  seat_limit = EXCLUDED.seat_limit,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id),
  plan_code text,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'trialing',
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  trial_credits_granted boolean DEFAULT false,
  last_metered_period_start timestamptz,
  last_metered_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_subscriptions_org_unique UNIQUE (organization_id)
);

ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view subscriptions" ON public.organization_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "Org admins can manage subscriptions" ON public.organization_subscriptions
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id));