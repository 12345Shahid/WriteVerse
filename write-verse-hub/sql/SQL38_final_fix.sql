-- 1. Fix the Metering Function (Ambiguous Column Error)
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
  v_balance bigint;
BEGIN
  -- Ensure credit row exists
  INSERT INTO public.organization_credits(organization_id) 
  VALUES (p_organization_id)
  ON CONFLICT (organization_id) DO NOTHING;

  -- Log Usage
  INSERT INTO public.usage_events(organization_id, user_id, tool, provider, action, units, cost_usd, credits, metadata)
  VALUES (p_organization_id, p_user_id, p_tool, p_provider, p_action, p_units, 0, p_credits, p_metadata);

  -- Deduct Credits (Fixed Ambiguity)
  UPDATE public.organization_credits
  SET balance_credits = balance_credits - COALESCE(p_credits, 0),
      total_deducted_credits = total_deducted_credits + COALESCE(p_credits, 0),
      updated_at = now()
  WHERE public.organization_credits.organization_id = p_organization_id
  RETURNING public.organization_credits.balance_credits INTO v_balance;

  -- Log Deduction
  INSERT INTO public.credit_deductions(organization_id, amount_credits, reason)
  VALUES (p_organization_id, p_credits, CONCAT('Usage: ', p_tool));

  -- Return
  organization_id := p_organization_id;
  balance_credits := v_balance;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update Available Models (Gemini 2.5 & 2.0)
-- Add new metadata columns if missing
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS category text DEFAULT 'Standard';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS speed text DEFAULT 'Medium';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS cost text DEFAULT 'Medium';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS best_for text DEFAULT '';

-- Clear old data
TRUNCATE TABLE public.ai_models;

-- Insert New Models
INSERT INTO public.ai_models (id, name, provider, category, context_length, credit_multiplier, speed, cost, best_for) VALUES
('openai/gpt-4o', 'GPT-4o (Smartest)', 'openrouter', 'Premium', 128000, 3.0, 'Fast', 'High', 'Complex reasoning, coding'),
('openai/gpt-4o-mini', 'GPT-4o Mini (Fast)', 'openrouter', 'Standard', 128000, 1.0, 'Very Fast', 'Low', 'Quick summaries, chat'),

('anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet', 'openrouter', 'Advanced', 200000, 1.5, 'Medium', 'Medium', 'Creative writing, coding'),
('anthropic/claude-3-opus', 'Claude 3 Opus', 'openrouter', 'Premium', 200000, 7.5, 'Slow', 'Very High', 'Complex analysis'),

('google/gemini-2.5-pro', 'Gemini 2.5 Pro', 'openrouter', 'Premium', 2000000, 3.0, 'Fast', 'Medium', 'Deep reasoning, multimodal'),
('google/gemini-2.5-flash', 'Gemini 2.5 Flash', 'openrouter', 'Standard', 1000000, 1.0, 'Very Fast', 'Low', 'High volume, fast tasks'),
('google/gemini-2.0-flash-001', 'Gemini 2.0 Flash', 'openrouter', 'Standard', 1000000, 0.8, 'Very Fast', 'Very Low', 'Real-time generation'),
('google/gemini-2.0-pro-exp-02-05', 'Gemini 2.0 Pro (Exp)', 'openrouter', 'Advanced', 2000000, 2.5, 'Medium', 'Medium', 'Experimental advanced features');
