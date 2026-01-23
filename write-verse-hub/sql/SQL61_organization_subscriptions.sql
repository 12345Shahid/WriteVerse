-- SQL61: Create organization_subscriptions table for subscription management
-- Run this in Supabase SQL Editor

-- 1. Create the subscription table
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  plan VARCHAR(20) NOT NULL DEFAULT 'trial', -- 'trial', 'starter', 'professional', 'business'
  status VARCHAR(20) NOT NULL DEFAULT 'trialing', -- 'trialing', 'active', 'past_due', 'canceled', 'expired'
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  monthly_credits INTEGER NOT NULL DEFAULT 2000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

-- 2. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_org_id ON organization_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status ON organization_subscriptions(status);

-- 3. Enable RLS
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Users can view their org subscription" ON organization_subscriptions;
CREATE POLICY "Users can view their org subscription"
ON organization_subscriptions FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON organization_subscriptions;
CREATE POLICY "Service role can manage subscriptions"
ON organization_subscriptions FOR ALL
USING (true)
WITH CHECK (true);

-- 5. Grant permissions
GRANT ALL ON organization_subscriptions TO authenticated;
GRANT ALL ON organization_subscriptions TO service_role;
