-- SQL8.sql: Team Content Migration & Audit Logs
-- Run this AFTER SQL7.sql

-- 1. Add organization_id to content tables
ALTER TABLE public.saved_results 
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.tool_usage 
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.ab_tests 
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_saved_results_org ON public.saved_results(organization_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_org ON public.tool_usage(organization_id);

-- 2. Migration Script: Create Personal Workspaces & Backfill
-- This block creates a personal organization for every user who doesn't belong to one,
-- and moves their existing data into it.
DO $$
DECLARE
  r RECORD;
  v_org_id uuid;
BEGIN
  FOR r IN SELECT * FROM public.users LOOP
    -- Check if user is already a member of ANY organization
    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = r.id) THEN
      
      -- Create 'Personal Workspace'
      INSERT INTO public.organizations (name, seat_limit)
      VALUES (split_part(r.email, '@', 1) || '''s Workspace', 1)
      RETURNING id INTO v_org_id;

      -- Add user as owner (Trigger in SQL7 might do this if auth.uid() was set, 
      -- but in a migration block auth.uid() might be null, so we insert manually to be safe)
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

-- 3. Update RLS for Team Access
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

-- 4. Audit Logs System
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    action text NOT NULL, -- e.g. 'created_post', 'invited_member'
    entity_type text NOT NULL, -- e.g. 'saved_result', 'invitation'
    entity_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_org_admin(organization_id));

-- 5. Trigger to Auto-Create Org for NEW users (Future signups)
-- Update handle_new_user from SQL4.sql to also create an org
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
  INSERT INTO public.organizations (name, seat_limit)
  VALUES (split_part(NEW.email, '@', 1) || '''s Workspace', 1)
  RETURNING id INTO v_org_id;

  -- 3. Add Member
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
