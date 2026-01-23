-- SQL62: Credit System - Model Tiers, Add-ons, and Enhanced Credit Tracking
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. MODEL CREDIT TIERS
-- Maps model IDs to credit multipliers
-- ============================================

CREATE TABLE IF NOT EXISTS model_credit_tiers (
  model_id TEXT PRIMARY KEY,
  tier INTEGER DEFAULT 1 CHECK (tier BETWEEN 1 AND 4),
  tier_name VARCHAR(20) DEFAULT 'Economy',
  credit_multiplier DECIMAL(3,1) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert tier mappings for all models
-- Tier 1: Economy (1x) - Standard category
INSERT INTO model_credit_tiers (model_id, tier, tier_name, credit_multiplier) VALUES
  ('google/gemini-2.0-flash-001', 1, 'Economy', 1.0),
  ('google/gemini-2.5-flash', 1, 'Economy', 1.0),
  ('openai/gpt-5-mini', 1, 'Economy', 1.0),
  ('openai/gpt-5-nano', 1, 'Economy', 1.0),
  ('openai/o4-mini', 1, 'Economy', 1.0),
  ('openai/gpt-4.1-mini', 1, 'Economy', 1.0),
  ('openai/gpt-4.1-nano', 1, 'Economy', 1.0),
  ('anthropic/claude-haiku-4.5', 1, 'Economy', 1.0)
ON CONFLICT (model_id) DO NOTHING;

-- Tier 2: Standard (2x) - Advanced category
INSERT INTO model_credit_tiers (model_id, tier, tier_name, credit_multiplier) VALUES
  ('openai/gpt-4.1', 2, 'Standard', 2.0),
  ('openai/o4-mini-high', 2, 'Standard', 2.0),
  ('anthropic/claude-sonnet-4', 2, 'Standard', 2.0),
  ('anthropic/claude-3.7-sonnet-thinking', 2, 'Standard', 2.0),
  ('google/gemini-2.5-pro', 2, 'Standard', 2.0)
ON CONFLICT (model_id) DO NOTHING;

-- Tier 3: Premium (3x) - Premium category
INSERT INTO model_credit_tiers (model_id, tier, tier_name, credit_multiplier) VALUES
  ('openai/gpt-5.1', 3, 'Premium', 3.0),
  ('openai/o4', 3, 'Premium', 3.0),
  ('anthropic/claude-opus-4.1', 3, 'Premium', 3.0),
  ('google/gemini-3-pro-preview', 3, 'Premium', 3.0)
ON CONFLICT (model_id) DO NOTHING;

-- Tier 4: Ultra (5x) - Frontier/Max models
INSERT INTO model_credit_tiers (model_id, tier, tier_name, credit_multiplier) VALUES
  ('openai/o4-max', 4, 'Ultra', 5.0)
ON CONFLICT (model_id) DO NOTHING;

-- Default tier function for unknown models
CREATE OR REPLACE FUNCTION get_model_credit_multiplier(p_model_id TEXT)
RETURNS DECIMAL AS $$
BEGIN
  RETURN COALESCE(
    (SELECT credit_multiplier FROM model_credit_tiers WHERE model_id = p_model_id),
    1.0  -- Default to 1x for unknown models
  );
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 2. SUBSCRIPTION ADD-ONS
-- Track purchased add-ons per organization
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  addon_type VARCHAR(50) NOT NULL,  -- 'extra_storage', 'composio_priority', 'advanced_analytics', 'api_rate_increase', 'extra_credits'
  quantity INTEGER DEFAULT 1,
  price_cents INTEGER NOT NULL,      -- Price in cents
  stripe_subscription_item_id TEXT,
  stripe_price_id TEXT,
  active BOOLEAN DEFAULT true,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addons_org ON subscription_addons(organization_id);
CREATE INDEX IF NOT EXISTS idx_addons_type ON subscription_addons(addon_type);

ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org addons" ON subscription_addons;
CREATE POLICY "Users can view their org addons"
ON subscription_addons FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
);


-- ============================================
-- 3. ADD-ON PRICE CATALOG
-- Reference table for add-on pricing
-- ============================================

CREATE TABLE IF NOT EXISTS addon_catalog (
  addon_type VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  unit VARCHAR(50),  -- 'per_month', 'per_5gb', 'per_1000_credits'
  stripe_price_id TEXT,
  active BOOLEAN DEFAULT true
);

INSERT INTO addon_catalog (addon_type, name, description, price_cents, unit) VALUES
  ('extra_storage', 'Extra Storage', 'Additional 5GB knowledge base storage', 1000, 'per_5gb'),
  ('composio_priority', 'Composio Priority', 'Faster tool execution, priority API access', 5000, 'per_month'),
  ('advanced_analytics', 'Advanced Analytics', 'ML-based insights, trend prediction', 3000, 'per_month'),
  ('api_rate_increase', 'API Rate Increase', 'Increase API limit from 100K to 1M requests', 10000, 'per_month'),
  ('extra_credits', 'Extra Credits', 'Pay-as-you-go credits (1000 credits)', 100, 'per_1000_credits')
ON CONFLICT (addon_type) DO UPDATE SET 
  price_cents = EXCLUDED.price_cents,
  description = EXCLUDED.description;


-- ============================================
-- 4. ENHANCED CREDIT DEDUCTION WITH TIERS
-- Update record_usage to use model tiers
-- ============================================

CREATE OR REPLACE FUNCTION public.record_usage_with_tiers(
  p_organization_id uuid,
  p_user_id uuid,
  p_tool text,
  p_provider text,
  p_action text,
  p_units integer,
  p_model_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  success boolean,
  balance_credits bigint,
  credits_deducted integer,
  credit_multiplier decimal
) AS $$
DECLARE
  v_multiplier decimal;
  v_credits_to_deduct integer;
  v_new_balance bigint;
BEGIN
  -- Get credit multiplier for model
  v_multiplier := COALESCE(
    (SELECT mct.credit_multiplier FROM model_credit_tiers mct WHERE mct.model_id = p_model_id),
    1.0
  );
  
  -- Calculate credits to deduct (units * multiplier)
  v_credits_to_deduct := CEIL(p_units * v_multiplier);
  
  -- Ensure credit row exists
  INSERT INTO public.organization_credits(organization_id) 
  VALUES (p_organization_id)
  ON CONFLICT (organization_id) DO NOTHING;

  -- Log the usage event
  INSERT INTO public.usage_events(organization_id, user_id, tool, provider, action, units, cost_usd, credits, metadata)
  VALUES (p_organization_id, p_user_id, p_tool, p_provider, p_action, p_units, 0, v_credits_to_deduct, 
    p_metadata || jsonb_build_object('model_id', p_model_id, 'credit_multiplier', v_multiplier));

  -- Deduct credits (allow going negative for graceful handling)
  UPDATE public.organization_credits
  SET balance_credits = balance_credits - v_credits_to_deduct,
      total_deducted_credits = total_deducted_credits + v_credits_to_deduct,
      updated_at = now()
  WHERE organization_id = p_organization_id
  RETURNING balance_credits INTO v_new_balance;

  RETURN QUERY SELECT true, v_new_balance, v_credits_to_deduct, v_multiplier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 5. CHECK CREDITS AVAILABLE FUNCTION
-- Returns if user has enough credits to proceed
-- ============================================

CREATE OR REPLACE FUNCTION public.check_credits_available(
  p_organization_id uuid,
  p_minimum_required integer DEFAULT 1
)
RETURNS TABLE (
  has_credits boolean,
  current_balance bigint,
  is_negative boolean
) AS $$
DECLARE
  v_balance bigint;
BEGIN
  SELECT COALESCE(balance_credits, 0) INTO v_balance
  FROM public.organization_credits
  WHERE organization_id = p_organization_id;
  
  IF v_balance IS NULL THEN
    v_balance := 0;
  END IF;
  
  RETURN QUERY SELECT 
    v_balance >= p_minimum_required,
    v_balance,
    v_balance < 0;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 6. ADD CREDITS FUNCTION (for purchases)
-- ============================================

CREATE OR REPLACE FUNCTION public.add_credits(
  p_organization_id uuid,
  p_credits integer,
  p_source text DEFAULT 'purchase'  -- 'purchase', 'trial', 'promo', 'subscription_renewal'
)
RETURNS bigint AS $$
DECLARE
  v_new_balance bigint;
BEGIN
  -- Ensure row exists
  INSERT INTO public.organization_credits(organization_id, balance_credits)
  VALUES (p_organization_id, 0)
  ON CONFLICT (organization_id) DO NOTHING;
  
  -- Add credits
  UPDATE public.organization_credits
  SET balance_credits = balance_credits + p_credits,
      updated_at = now()
  WHERE organization_id = p_organization_id
  RETURNING balance_credits INTO v_new_balance;
  
  -- Log the addition
  INSERT INTO public.credit_deductions(organization_id, amount_credits, reason, metadata)
  VALUES (p_organization_id, -p_credits, p_source, jsonb_build_object('credits_added', p_credits));
  
  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Grant permissions
GRANT EXECUTE ON FUNCTION get_model_credit_multiplier(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_usage_with_tiers TO authenticated;
GRANT EXECUTE ON FUNCTION record_usage_with_tiers TO service_role;
GRANT EXECUTE ON FUNCTION check_credits_available TO authenticated;
GRANT EXECUTE ON FUNCTION add_credits TO service_role;
GRANT ALL ON subscription_addons TO authenticated;
GRANT ALL ON subscription_addons TO service_role;
GRANT SELECT ON addon_catalog TO authenticated;
GRANT ALL ON model_credit_tiers TO service_role;
GRANT SELECT ON model_credit_tiers TO authenticated;
