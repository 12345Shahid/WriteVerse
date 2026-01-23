-- SQL47_fix_subscription_policy.sql
-- Make subscription_plans policy creation idempotent and safe to re-run.

DO $$
BEGIN
  -- Only create the policy if it does not already exist
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscription_plans'
      AND policyname = 'Everyone can view active subscription plans'
  ) THEN
    CREATE POLICY "Everyone can view active subscription plans" ON public.subscription_plans
      FOR SELECT USING (is_active = true);
  END IF;
END $$;
