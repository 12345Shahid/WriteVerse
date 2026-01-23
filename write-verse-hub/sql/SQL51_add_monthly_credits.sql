-- SQL51_add_monthly_credits_function.sql
-- Function to add monthly subscription credits (called by webhook)

CREATE OR REPLACE FUNCTION public.add_monthly_credits(
  p_organization_id uuid,
  p_credits integer
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

  -- Add credits (increment, not replace)
  UPDATE public.organization_credits
  SET balance_credits = organization_credits.balance_credits + p_credits,
      updated_at = now()
  WHERE organization_credits.organization_id = p_organization_id
  RETURNING organization_credits.balance_credits INTO v_balance;

  -- Log the transaction
  INSERT INTO public.credit_deductions(organization_id, amount_credits, reason)
  VALUES (p_organization_id, -p_credits, 'Monthly subscription credits');

  RETURN QUERY SELECT p_organization_id, v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- this is batch 53
