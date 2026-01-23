-- Drop existing function first to allow return type change
DROP FUNCTION IF EXISTS public.record_usage(uuid, uuid, text, text, text, numeric, integer, jsonb);

-- Recreate function with non-ambiguous return columns
CREATE OR REPLACE FUNCTION public.record_usage(
  p_organization_id uuid,
  p_user_id uuid,
  p_tool text,
  p_provider text,
  p_action text,
  p_units numeric,
  p_credits integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  res_organization_id uuid,
  res_balance_credits bigint
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

  -- 4. Log Deduction (if credit_deductions table exists)
  INSERT INTO public.credit_deductions(organization_id, amount_credits, reason)
  VALUES (p_organization_id, p_credits, CONCAT('Usage: ', p_tool));

  -- 5. Return new balance
  SELECT * INTO v_org_credits FROM public.organization_credits WHERE organization_id = p_organization_id;
  
  res_organization_id := v_org_credits.organization_id;
  res_balance_credits := v_org_credits.balance_credits;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
