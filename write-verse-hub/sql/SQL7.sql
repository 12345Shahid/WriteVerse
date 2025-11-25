-- SQL7.sql: Team Management Schema
-- Run this in Supabase SQL editor

-- 1. Create Role Enum
DO $$ BEGIN
    CREATE TYPE organization_role_enum AS ENUM ('owner', 'admin', 'editor', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text, -- Optional unique slug for URLs
    subscription_tier subscription_tier_enum NOT NULL DEFAULT 'free',
    seat_limit integer NOT NULL DEFAULT 5,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Organization Members Table
CREATE TABLE IF NOT EXISTS public.organization_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role organization_role_enum NOT NULL DEFAULT 'viewer',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- 4. Invitations Table
CREATE TABLE IF NOT EXISTS public.invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email text NOT NULL,
    role organization_role_enum NOT NULL DEFAULT 'viewer',
    token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    invited_by uuid REFERENCES public.users(id),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
    created_at timestamptz NOT NULL DEFAULT now(),
    accepted_at timestamptz
);

-- 5. Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- 6. Helper Functions for RLS

-- Helper: Check if auth user is a member of org
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: Check if auth user is admin/owner of org
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Policies

-- Organizations Policies
DROP POLICY IF EXISTS "Members can view their organizations" ON public.organizations;
CREATE POLICY "Members can view their organizations"
ON public.organizations FOR SELECT
TO authenticated
USING (public.is_org_member(id));

DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
CREATE POLICY "Users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update organizations" ON public.organizations;
CREATE POLICY "Admins can update organizations"
ON public.organizations FOR UPDATE
TO authenticated
USING (public.is_org_admin(id));

-- Organization Members Policies
DROP POLICY IF EXISTS "Members can view teammates" ON public.organization_members;
CREATE POLICY "Members can view teammates"
ON public.organization_members FOR SELECT
TO authenticated
USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Admins can manage members" ON public.organization_members;
CREATE POLICY "Admins can manage members"
ON public.organization_members FOR ALL
TO authenticated
USING (public.is_org_admin(organization_id))
WITH CHECK (public.is_org_admin(organization_id));

-- Invitations Policies
DROP POLICY IF EXISTS "Admins can view invitations" ON public.invitations;
CREATE POLICY "Admins can view invitations"
ON public.invitations FOR SELECT
TO authenticated
USING (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Admins can create invitations" ON public.invitations;
CREATE POLICY "Admins can create invitations"
ON public.invitations FOR INSERT
TO authenticated
WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Admins can manage invitations" ON public.invitations;
CREATE POLICY "Admins can manage invitations"
ON public.invitations FOR ALL
TO authenticated
USING (public.is_org_admin(organization_id));

-- 8. Triggers

-- Auto-add creator as owner when Org is created
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- Update 'updated_at' timestamp
DROP TRIGGER IF EXISTS organizations_set_updated_at ON public.organizations;
CREATE TRIGGER organizations_set_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
