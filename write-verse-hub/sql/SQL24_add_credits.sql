-- Grant 500 credits to all existing organizations for testing purposes

-- 1. Ensure organization_credits entries exist for all orgs
INSERT INTO public.organization_credits (organization_id, balance_credits)
SELECT 
  id as organization_id, 
  500 as balance_credits
FROM public.organizations
ON CONFLICT (organization_id) 
DO UPDATE SET 
  balance_credits = organization_credits.balance_credits + 500,
  updated_at = now();

-- 2. (Optional) Log this manual grant if there's a usage log, but for testing we skip it.
