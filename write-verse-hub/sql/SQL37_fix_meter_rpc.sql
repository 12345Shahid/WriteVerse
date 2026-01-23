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
  WHERE public.organization_credits.organization_id = p_organization_id
  RETURNING public.organization_credits.balance_credits INTO v_balance;

  -- 4. Log Deduction
  INSERT INTO public.credit_deductions(organization_id, amount_credits, reason)
  VALUES (p_organization_id, p_credits, CONCAT('Usage: ', p_tool));

  -- 5. Return new balance
  organization_id := p_organization_id;
  balance_credits := v_balance;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
