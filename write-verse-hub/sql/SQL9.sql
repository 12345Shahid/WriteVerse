-- SQL9.sql: Fix for Team Migration (Replaces SQL8)
-- Run this in Supabase SQL Editor

-- 1. Fix the Trigger to handle NULL auth.uid() (Migration Safety)
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS trigger AS $$
BEGIN
  -- Only auto-add owner if there is a logged-in user
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (NEW.id, auth.uid(), 'owner');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Add organization_id to content tables (Idempotent)
ALTER TABLE public.saved_results 
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.tool_usage 
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.ab_tests 
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_saved_results_org ON public.saved_results(organization_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_org ON public.tool_usage(organization_id);

-- 3. Migration Script: Create Personal Workspaces & Backfill
DO $$
DECLARE
  r RECORD;
  v_org_id uuid;
BEGIN
  FOR r IN SELECT * FROM public.users LOOP
    -- Check if user is already a member of ANY organization
    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = r.id) THEN
      
      -- Create 'Personal Workspace'
      -- Note: The trigger will fire but do nothing because auth.uid() is null here
      INSERT INTO public.organizations (name, seat_limit)
      VALUES (split_part(r.email, '@', 1) || '''s Workspace', 1)
      RETURNING id INTO v_org_id;

      -- Manually add user as owner since trigger didn't do it
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (v_org_id, r.id, 'owner')
      ON CONFLICT DO NOTHING;

      -- Backfill content
      UPDATE public.saved_results SET organization_id = v_org_id WHERE user_id = r.id AND organization_id IS NULL;
      UPDATE public.tool_usage SET organization_id = v_org_id WHERE user_id = r.id AND organization_id IS NULL;
      UPDATE public.ab_tests SET organization_id = v_org_id WHERE user_id = r.id AND organization_id IS NULL;
      
    END IF;
  END LOOP;
END $$;

-- 4. Update RLS for Team Access
-- We now allow access if you are a member of the organization_id

-- SAVED_RESULTS Team Policy
DROP POLICY IF EXISTS "Saved results select own" ON public.saved_results;
DROP POLICY IF EXISTS "Saved results select team" ON public.saved_results;
CREATE POLICY "Saved results select team"
  ON public.saved_results FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(organization_id) 
    OR (organization_id IS NULL AND user_id = auth.uid()) -- Fallback for orphans
  );

DROP POLICY IF EXISTS "Saved results insert own" ON public.saved_results;
DROP POLICY IF EXISTS "Saved results insert team" ON public.saved_results;
CREATE POLICY "Saved results insert team"
  ON public.saved_results FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id)
    OR (organization_id IS NULL AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Saved results delete own" ON public.saved_results;
DROP POLICY IF EXISTS "Saved results delete team" ON public.saved_results;
CREATE POLICY "Saved results delete team"
  ON public.saved_results FOR DELETE
  TO authenticated
  USING (
    -- Only Admins/Owners or the Creator can delete
    (public.is_org_admin(organization_id)) 
    OR 
    (public.is_org_member(organization_id) AND user_id = auth.uid())
  );

-- 5. Audit Logs System (Idempotent)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    action text NOT NULL, 
    entity_type text NOT NULL,
    entity_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_org_admin(organization_id));

-- 6. Update Handle New User Trigger for Future Signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- 1. Create Profile
  INSERT INTO public.users (id, email, credits_balance, credits_lifetime)
  VALUES (NEW.id, NEW.email, 500, 500)
  ON CONFLICT (id) DO NOTHING;

  -- 2. Create Personal Org
  -- Trigger will fire but might fail if auth.uid() is not set correctly during signup flow?
  -- Actually, during signup auth.uid() IS the new user usually.
  -- But let's be explicit and manual to avoid recursion/trigger issues.
  INSERT INTO public.organizations (name, seat_limit)
  VALUES (split_part(NEW.email, '@', 1) || '''s Workspace', 1)
  RETURNING id INTO v_org_id;

  -- 3. Add Member
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, NEW.id, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
