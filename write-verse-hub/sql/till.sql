-- SQL1.sql: Initial schema for WriterAI
-- Run in Supabase SQL editor

-- Extensions
create extension if not exists pgcrypto;

-- Enum for subscription tiers
do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_tier_enum') then
    create type subscription_tier_enum as enum ('free', 'pro', 'premium');
  end if;
end $$;

-- Users table (profile) referencing auth.users
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  subscription_tier subscription_tier_enum not null default 'free',
  monthly_token_limit integer not null default 5000,
  tokens_used_this_month integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tool usage table
create table if not exists public.tool_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tool_name text not null,
  input_tokens_used integer,
  output_tokens_used integer,
  timestamp timestamptz not null default now()
);

-- Saved results table
create table if not exists public.saved_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tool_name text not null,
  input_data jsonb not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);

-- Trigger to update updated_at on users
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- Function + trigger to update monthly tokens on insert into tool_usage
create or replace function public.increment_monthly_tokens()
returns trigger as $$
declare
  v_tokens integer;
begin
  v_tokens := coalesce(new.input_tokens_used, 0) + coalesce(new.output_tokens_used, 0);
  update public.users
    set tokens_used_this_month = coalesce(tokens_used_this_month, 0) + v_tokens,
        updated_at = now()
  where id = new.user_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tool_usage_increment_tokens on public.tool_usage;
create trigger tool_usage_increment_tokens
after insert on public.tool_usage
for each row execute function public.increment_monthly_tokens();


-- this is batch one and it executed successfully.







-- SQL2.sql: Enable RLS and policies for WriterAI
-- Run in Supabase SQL editor after SQL1.sql

-- Enable RLS
alter table if exists public.users enable row level security;
alter table if exists public.tool_usage enable row level security;
alter table if exists public.saved_results enable row level security;

-- USERS policies
create policy if not exists "Users select own profile"
  on public.users for select
  to authenticated
  using (id = auth.uid());

create policy if not exists "Users update own profile"
  on public.users for update
  to authenticated
  using (id = auth.uid());

-- TOOL_USAGE policies
create policy if not exists "Tool usage select own"
  on public.tool_usage for select
  to authenticated
  using (user_id = auth.uid());

create policy if not exists "Tool usage insert own"
  on public.tool_usage for insert
  to authenticated
  with check (user_id = auth.uid());

-- SAVED_RESULTS policies
create policy if not exists "Saved results select own"
  on public.saved_results for select
  to authenticated
  using (user_id = auth.uid());

create policy if not exists "Saved results insert own"
  on public.saved_results for insert
  to authenticated
  with check (user_id = auth.uid());

create policy if not exists "Saved results delete own"
  on public.saved_results for delete
  to authenticated
  using (user_id = auth.uid());

-- On auth.users insert, create public.users row
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- this is batch two and it didnot execute successfully.

-- It returned the error below: Error: Failed to run sql query: ERROR: 42601: syntax error at or near "not" LINE 10: create policy if not exists "Users select own profile" ^














-- SQL3.sql: Fix RLS policy creation for Supabase (remove IF NOT EXISTS)
-- Purpose: Supabase/Postgres version may not support `CREATE POLICY IF NOT EXISTS`.
-- Strategy: Drop policies if they exist, then recreate them without IF NOT EXISTS.

-- Ensure RLS is enabled (idempotent)
alter table if exists public.users enable row level security;
alter table if exists public.tool_usage enable row level security;
alter table if exists public.saved_results enable row level security;

-- USERS policies
DROP POLICY IF EXISTS "Users select own profile" ON public.users;
CREATE POLICY "Users select own profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users update own profile" ON public.users;
CREATE POLICY "Users update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- TOOL_USAGE policies
DROP POLICY IF EXISTS "Tool usage select own" ON public.tool_usage;
CREATE POLICY "Tool usage select own"
  ON public.tool_usage FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Tool usage insert own" ON public.tool_usage;
CREATE POLICY "Tool usage insert own"
  ON public.tool_usage FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- SAVED_RESULTS policies
DROP POLICY IF EXISTS "Saved results select own" ON public.saved_results;
CREATE POLICY "Saved results select own"
  ON public.saved_results FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Saved results insert own" ON public.saved_results;
CREATE POLICY "Saved results insert own"
  ON public.saved_results FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Saved results delete own" ON public.saved_results;
CREATE POLICY "Saved results delete own"
  ON public.saved_results FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Recreate onboarding trigger in case SQL2.sql stopped before this section
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- this is batch three and it executed successfully.






















-- SQL4.sql: Add credits columns and set initial values
-- Run this in Supabase SQL editor after SQL1..SQL3

-- Add credits columns to users profile
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS credits_balance integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS credits_lifetime integer NOT NULL DEFAULT 500;

-- Backfill existing rows to a sane default for development/testing
UPDATE public.users
SET credits_balance = 500
WHERE credits_balance IS NULL OR credits_balance = 0;

UPDATE public.users
SET credits_lifetime = GREATEST(COALESCE(credits_lifetime, 0), credits_balance)
WHERE credits_lifetime IS NULL OR credits_lifetime = 0;

-- Ensure the onboarding trigger gives starter credits to new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, credits_balance, credits_lifetime)
  VALUES (NEW.id, NEW.email, 500, 500)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- this is batch four and it executed successfully.






















-- SQL5: New features schema additions

-- Enable required extension for UUID if not present
create extension if not exists pgcrypto;

-- A/B tests table
create table if not exists public.ab_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  input_summary text,
  variant_a text not null,
  variant_b text not null,
  winner text check (winner in ('A','B')),
  created_at timestamptz not null default now()
);

alter table public.ab_tests enable row level security;

-- Only owner can manage their A/B tests
create policy if not exists ab_tests_select_own on public.ab_tests
  for select using (auth.uid() = user_id);
create policy if not exists ab_tests_modify_own on public.ab_tests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_ab_tests_user on public.ab_tests(user_id);

-- Public sharing for saved_results
alter table public.saved_results add column if not exists is_public boolean not null default false;
alter table public.saved_results add column if not exists public_slug text unique;
create index if not exists idx_saved_results_slug on public.saved_results(public_slug);

-- Credits transactions for Stripe checkout bookkeeping
create table if not exists public.credits_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  credits_added integer not null check (credits_added > 0),
  status text not null default 'pending',
  stripe_session_id text,
  created_at timestamptz not null default now()
);

alter table public.credits_transactions enable row level security;
create policy if not exists credits_tx_select_own on public.credits_transactions
  for select using (auth.uid() = user_id);
create index if not exists idx_credits_tx_user on public.credits_transactions(user_id);


-- this is batch five and it diidnot execute successfully
-- it gave the error: Error: Failed to run sql query: ERROR: 42601: syntax error at or near "not" LINE 21: create policy if not exists ab_tests_select_own on public.ab_tests ^






























-- SQL6: Fix SQL5 policy syntax and complete migration safely
-- Run this in Supabase SQL editor on the SAME project your backend uses

begin;

-- Ensure uuid generation is available
create extension if not exists pgcrypto;

-- A/B tests table (idempotent)
create table if not exists public.ab_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  input_summary text,
  variant_a text not null,
  variant_b text not null,
  winner text check (winner in ('A','B')),
  created_at timestamptz not null default now()
);

-- Enable RLS and create policies only if missing (CREATE POLICY has no IF NOT EXISTS)
alter table public.ab_tests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ab_tests' and policyname = 'ab_tests_select_own'
  ) then
    execute 'create policy ab_tests_select_own on public.ab_tests for select using (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ab_tests' and policyname = 'ab_tests_modify_own'
  ) then
    execute 'create policy ab_tests_modify_own on public.ab_tests for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;

create index if not exists idx_ab_tests_user on public.ab_tests(user_id);

-- Public sharing columns on saved_results (idempotent)
alter table public.saved_results add column if not exists is_public boolean not null default false;
alter table public.saved_results add column if not exists public_slug text unique;
create index if not exists idx_saved_results_slug on public.saved_results(public_slug);

-- Credits transactions (idempotent)
create table if not exists public.credits_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  credits_added integer not null check (credits_added > 0),
  status text not null default 'pending',
  stripe_session_id text,
  created_at timestamptz not null default now()
);

alter table public.credits_transactions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'credits_transactions' and policyname = 'credits_tx_select_own'
  ) then
    execute 'create policy credits_tx_select_own on public.credits_transactions for select using (auth.uid() = user_id)';
  end if;
end $$;

create index if not exists idx_credits_tx_user on public.credits_transactions(user_id);

commit;

-- this is batch six and it executed successfully.





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

-- this is batch seven and it executed successfully.

















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


-- this is batch eight and it didnot executed successfully.
--DETAIL: Failing row contains (67489692-5b0c-4d7e-84ac-0e6f80633ef4, 65a6c9cb-6ab7-4929-878a-f97be8f579ef, null, owner, 2025-11-22 09:19:01.739666+00). CONTEXT: SQL statement "INSERT INTO public.organization_members (organization_id, user_id, role) VALUES (NEW.id, auth.uid(), 'owner')" PL/pgSQL function handle_new_organization() line 3 at SQL statement SQL statement "INSERT INTO public.organizations (name, seat_limit) VALUES (split_part(r.email, '@', 1) || '''s Workspace', 1) RETURNING id" PL/pgSQL function inline_code_block line 11 at SQL statement




















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


-- this is batch nine and it executed successfully.




















-- 1. Create Organization Credits Table
CREATE TABLE IF NOT EXISTS public.organization_credits (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  balance_credits bigint NOT NULL DEFAULT 0,
  meter_usd numeric(12,4) NOT NULL DEFAULT 0, -- Tracks fractional spend
  total_spent_usd numeric(12,4) NOT NULL DEFAULT 0,
  total_deducted_credits bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Usage Events (Detailed Logging)
CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id), -- Who performed the action
  tool text,         -- e.g., 'blog_post', 'email_writer'
  provider text,     -- e.g., 'openai', 'anthropic'
  action text,       -- e.g., 'generate', 'edit'
  units numeric,     -- e.g., token count or words
  cost_usd numeric(12,4) NOT NULL DEFAULT 0,
  credits integer,   -- Credits deducted for this specific event
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_org ON public.usage_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON public.usage_events(created_at);

-- 3. Credit Deductions Log (Audit Trail)
CREATE TABLE IF NOT EXISTS public.credit_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount_credits integer NOT NULL, -- Negative for top-ups, Positive for usage
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Trigger to Initialize Credits on Org Creation
CREATE OR REPLACE FUNCTION public.init_org_credits()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.organization_credits (organization_id, balance_credits)
  VALUES (NEW.id, 100) -- Start with 100 free credits
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_org_created_credits ON public.organizations;
CREATE TRIGGER on_org_created_credits
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.init_org_credits();

-- 5. Usage Recording Function
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

  -- 4. Log Deduction
  INSERT INTO public.credit_deductions(organization_id, amount_credits, reason)
  VALUES (p_organization_id, p_credits, CONCAT('Usage: ', p_tool));

  -- 5. Return new balance
  SELECT * INTO v_org_credits FROM public.organization_credits WHERE organization_id = p_organization_id;
  RETURN QUERY SELECT v_org_credits.organization_id, v_org_credits.balance_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Brand Kits (New Feature)
CREATE TABLE IF NOT EXISTS public.brand_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default Brand',
  logo_url text,
  primary_color text,
  secondary_color text,
  font_family text,
  tone_of_voice text, -- Specific to WriterAI
  website_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- RLS for Brand Kits
ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view brand kits" ON public.brand_kits
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "Admins can manage brand kits" ON public.brand_kits
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id));

-- 7. Migration Strategy (Moving Users to Orgs)
DO $$
DECLARE
  r RECORD;
  v_org_id uuid;
BEGIN
  FOR r IN SELECT * FROM public.users WHERE credits_balance > 0 LOOP
    -- Find their personal organization (Owner role)
    SELECT organization_id INTO v_org_id
    FROM public.organization_members
    WHERE user_id = r.id AND role = 'owner'
    LIMIT 1;

    IF v_org_id IS NOT NULL THEN
      -- Initialize Organization Credits with User's Balance
      INSERT INTO public.organization_credits (organization_id, balance_credits)
      VALUES (v_org_id, r.credits_balance)
      ON CONFLICT (organization_id) 
      DO UPDATE SET balance_credits = public.organization_credits.balance_credits + r.credits_balance;

      -- Optional: Zero out user credits to avoid double spending
      -- UPDATE public.users SET credits_balance = 0 WHERE id = r.id;
    END IF;
  END LOOP;
END $$;


--  this is batch 10 and it executed successfully.




















-- 1. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assignee_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  due_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Link Content to Projects
ALTER TABLE public.saved_results
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_saved_results_project ON public.saved_results(project_id);

-- 4. RLS Policies

-- Projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view projects" ON public.projects;
CREATE POLICY "Members can view projects" ON public.projects
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can insert projects" ON public.projects;
CREATE POLICY "Members can insert projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can update projects" ON public.projects;
CREATE POLICY "Members can update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;
CREATE POLICY "Admins can delete projects" ON public.projects
  FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id));

-- Tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view tasks" ON public.tasks;
CREATE POLICY "Members can view tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
      AND public.is_org_member(p.organization_id)
    )
  );

DROP POLICY IF EXISTS "Members can manage tasks" ON public.tasks;
CREATE POLICY "Members can manage tasks" ON public.tasks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
      AND public.is_org_member(p.organization_id)
    )
  );

-- Update triggers
DROP TRIGGER IF EXISTS projects_updated_at ON public.projects;
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- this is batch 11 and it executed successfully 

















-- 1. Assets Table
CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  storage_path text NOT NULL,
  file_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL
);

-- 2. RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- View Policy
DROP POLICY IF EXISTS "Members can view assets" ON public.assets;
CREATE POLICY "Members can view assets" ON public.assets
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

-- Insert Policy
DROP POLICY IF EXISTS "Members can insert assets" ON public.assets;
CREATE POLICY "Members can insert assets" ON public.assets
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

-- Delete Policy
DROP POLICY IF EXISTS "Members can delete assets" ON public.assets;
CREATE POLICY "Members can delete assets" ON public.assets
  FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id));

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_assets_org ON public.assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_assets_project ON public.assets(project_id);

-- 4. Storage Setup (Attempting to configure storage via SQL)
-- Create 'assets' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/view in 'assets' bucket
DROP POLICY IF EXISTS "Authenticated users can access assets bucket" ON storage.objects;
CREATE POLICY "Authenticated users can access assets bucket" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'assets')
  WITH CHECK (bucket_id = 'assets');


-- this is batch 12 and it executed successfully













-- 1. Folders Table
CREATE TABLE IF NOT EXISTS public.folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Update Assets Table
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL;

-- 3. RLS for Folders
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view folders" ON public.folders;
CREATE POLICY "Members can view folders" ON public.folders
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can manage folders" ON public.folders;
CREATE POLICY "Members can manage folders" ON public.folders
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id));

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_folders_org ON public.folders(organization_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON public.folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_assets_folder ON public.assets(folder_id);


-- this is batch 13 and it executed successfully

















-- Link Assets to Tasks (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.task_assets (
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, asset_id)
);

ALTER TABLE public.task_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view task assets" ON public.task_assets;
CREATE POLICY "Members can view task assets" ON public.task_assets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON t.project_id = p.id
      WHERE t.id = task_assets.task_id
      AND public.is_org_member(p.organization_id)
    )
  );

DROP POLICY IF EXISTS "Members can manage task assets" ON public.task_assets;
CREATE POLICY "Members can manage task assets" ON public.task_assets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON t.project_id = p.id
      WHERE t.id = task_assets.task_id
      AND public.is_org_member(p.organization_id)
    )
  );
-- this is batch 14 and it executed successfully




















-- 1. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view categories" ON public.categories;
CREATE POLICY "Members can view categories" ON public.categories
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can manage categories" ON public.categories;
CREATE POLICY "Members can manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id));

-- 2. Tags Table
CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view tags" ON public.tags;
CREATE POLICY "Members can view tags" ON public.tags
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can manage tags" ON public.tags;
CREATE POLICY "Members can manage tags" ON public.tags
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id));

-- 3. Asset Tags (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.asset_tags (
  asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, tag_id)
);

ALTER TABLE public.asset_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view asset tags" ON public.asset_tags;
CREATE POLICY "Members can view asset tags" ON public.asset_tags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_tags.asset_id
      AND public.is_org_member(a.organization_id)
    )
  );

DROP POLICY IF EXISTS "Members can manage asset tags" ON public.asset_tags;
CREATE POLICY "Members can manage asset tags" ON public.asset_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_tags.asset_id
      AND public.is_org_member(a.organization_id)
    )
  );

-- 4. Update Assets/Folders columns
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_categories_org ON public.categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_tags_org ON public.tags(organization_id);
CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(category_id);
CREATE INDEX IF NOT EXISTS idx_folders_category ON public.folders(category_id);


-- this is batch 15 and it executed successfully

















-- 1. Project Tags (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.project_tags (
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, tag_id)
);

ALTER TABLE public.project_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view project tags" ON public.project_tags;
CREATE POLICY "Members can view project tags" ON public.project_tags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_tags.project_id
      AND public.is_org_member(p.organization_id)
    )
  );

DROP POLICY IF EXISTS "Members can manage project tags" ON public.project_tags;
CREATE POLICY "Members can manage project tags" ON public.project_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_tags.project_id
      AND public.is_org_member(p.organization_id)
    )
  );

-- 2. Folder Tags (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.folder_tags (
  folder_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (folder_id, tag_id)
);

ALTER TABLE public.folder_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view folder tags" ON public.folder_tags;
CREATE POLICY "Members can view folder tags" ON public.folder_tags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.folders f
      WHERE f.id = folder_tags.folder_id
      AND public.is_org_member(f.organization_id)
    )
  );

DROP POLICY IF EXISTS "Members can manage folder tags" ON public.folder_tags;
CREATE POLICY "Members can manage folder tags" ON public.folder_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.folders f
      WHERE f.id = folder_tags.folder_id
      AND public.is_org_member(f.organization_id)
    )
  );

-- this is batch 16 and it executed successfully




















-- 1. Task Tags (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.task_tags (
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view task tags" ON public.task_tags;
CREATE POLICY "Members can view task tags" ON public.task_tags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON t.project_id = p.id
      WHERE t.id = task_tags.task_id
      AND public.is_org_member(p.organization_id)
    )
  );

DROP POLICY IF EXISTS "Members can manage task tags" ON public.task_tags;
CREATE POLICY "Members can manage task tags" ON public.task_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON t.project_id = p.id
      WHERE t.id = task_tags.task_id
      AND public.is_org_member(p.organization_id)
    )
  );

-- 2. Project Assets (Many-to-Many) - For attaching files to the project itself
CREATE TABLE IF NOT EXISTS public.project_assets (
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE,
  added_at timestamptz DEFAULT now(),
  PRIMARY KEY (project_id, asset_id)
);

ALTER TABLE public.project_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view project assets" ON public.project_assets;
CREATE POLICY "Members can view project assets" ON public.project_assets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_assets.project_id
      AND public.is_org_member(p.organization_id)
    )
  );

DROP POLICY IF EXISTS "Members can manage project assets" ON public.project_assets;
CREATE POLICY "Members can manage project assets" ON public.project_assets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_assets.project_id
      AND public.is_org_member(p.organization_id)
    )
  );
-- this is batch 17 and it executed successfully
















-- Project Tags (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.project_tags (
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, tag_id)
);

ALTER TABLE public.project_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view project tags" ON public.project_tags;
CREATE POLICY "Members can view project tags" ON public.project_tags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_tags.project_id
      AND public.is_org_member(p.organization_id)
    )
  );

DROP POLICY IF EXISTS "Members can manage project tags" ON public.project_tags;
CREATE POLICY "Members can manage project tags" ON public.project_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_tags.project_id
      AND public.is_org_member(p.organization_id)
    )
  );

-- this is batch 18 and it executed successfully













-- Content Templates Table for Custom Tools
CREATE TABLE IF NOT EXISTS public.content_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text DEFAULT 'custom',
  icon text,
  schema jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of field definitions: { key, label, type, placeholder }
  prompt_text text NOT NULL, -- "Write a {key} for {other_key}..."
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_templates ENABLE ROW LEVEL SECURITY;

-- Policies
-- View: All members of the org
DROP POLICY IF EXISTS "Org members can view templates" ON public.content_templates;
CREATE POLICY "Org members can view templates" ON public.content_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = content_templates.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Manage: Editors, Admins, Owners
DROP POLICY IF EXISTS "Org editors can manage templates" ON public.content_templates;
CREATE POLICY "Org editors can manage templates" ON public.content_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = content_templates.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'editor')
    )
  );


-- this is batch 19 and it executed successfully

















-- Team Chat Tables

-- Threads
CREATE TABLE IF NOT EXISTS public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  topic text NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL, -- Null for AI
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_threads_org ON public.chat_threads(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON public.chat_messages(thread_id);

-- RLS
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies for Threads
DROP POLICY IF EXISTS "Org members can view threads" ON public.chat_threads;
CREATE POLICY "Org members can view threads" ON public.chat_threads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = chat_threads.organization_id
      AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can create threads" ON public.chat_threads;
CREATE POLICY "Org members can create threads" ON public.chat_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = chat_threads.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Policies for Messages
DROP POLICY IF EXISTS "Org members can view messages" ON public.chat_messages;
CREATE POLICY "Org members can view messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_threads t
      JOIN public.organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = chat_messages.thread_id
      AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can insert messages" ON public.chat_messages;
CREATE POLICY "Org members can insert messages" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_threads t
      JOIN public.organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = chat_messages.thread_id
      AND om.user_id = auth.uid()
    )
  );

-- Enable Realtime
DO $$
BEGIN
  -- Check if publication exists, if not create it (standard in Supabase)
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- Add tables to publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_threads;


-- this is batch 20 and it executed successfully


















-- 1. Chat Uniqueness
-- Add unique constraint to chat_threads for (organization_id, topic)
ALTER TABLE public.chat_threads 
ADD CONSTRAINT chat_threads_org_topic_key UNIQUE (organization_id, topic);


-- 2. Saved Results Isolation
-- Add organization_id to saved_results
ALTER TABLE public.saved_results 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill organization_id for existing records? 
-- It's hard to know which org a record belongs to if the user has multiple.
-- We will leave it NULL for now or assign to the user's first org if needed.
-- For this dev environment, we'll assume data can be truncated or we just start fresh.
-- But to be safe, let's try to populate it from tool_usage or just leave nullable for now, 
-- BUT policies will hide NULL ones if we filter by org.
-- Let's make it NOT NULL eventually, but for migration allow NULL.

-- Enable RLS (already enabled in till.sql, but policies need update)
ALTER TABLE public.saved_results ENABLE ROW LEVEL SECURITY;

-- Update Saved Results Policies
DROP POLICY IF EXISTS "Users select own saved results" ON public.saved_results;
DROP POLICY IF EXISTS "Users insert own saved results" ON public.saved_results;
DROP POLICY IF EXISTS "Users delete own saved results" ON public.saved_results;
-- (The old policies were likely "Users select own profile" based on user_id)

-- New Policy: Org Members can view/manage saved results
DROP POLICY IF EXISTS "Org members can view saved results" ON public.saved_results;
CREATE POLICY "Org members can view saved results" ON public.saved_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = saved_results.organization_id
      AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can insert saved results" ON public.saved_results;
CREATE POLICY "Org members can insert saved results" ON public.saved_results
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = saved_results.organization_id
      AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can delete saved results" ON public.saved_results;
CREATE POLICY "Org members can delete saved results" ON public.saved_results
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = saved_results.organization_id
      AND om.user_id = auth.uid()
    )
  );
-- this is batch 21 and it executed successfully


















-- Brand Voice System Tables

CREATE TABLE IF NOT EXISTS public.brand_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  tone_tags text[], -- e.g. ['Friendly', 'Professional']
  rules jsonb DEFAULT '{"dos": [], "donts": []}'::jsonb, -- Structured rules
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_voice_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_id uuid NOT NULL REFERENCES public.brand_voices(id) ON DELETE CASCADE,
  content text NOT NULL, -- The actual sample text
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brand_voices_org ON public.brand_voices(organization_id);
CREATE INDEX IF NOT EXISTS idx_brand_voice_samples_voice ON public.brand_voice_samples(voice_id);

-- RLS
ALTER TABLE public.brand_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_voice_samples ENABLE ROW LEVEL SECURITY;

-- Policies for Brand Voices

-- View: All Org Members
DROP POLICY IF EXISTS "Org members can view brand voices" ON public.brand_voices;
CREATE POLICY "Org members can view brand voices" ON public.brand_voices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = brand_voices.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Manage: Only Admins (and maybe creator? Let's stick to Admin based on previous RBAC consolidation)
-- Actually, Users with 'role=admin' in organization_members.
DROP POLICY IF EXISTS "Admins can manage brand voices" ON public.brand_voices;
CREATE POLICY "Admins can manage brand voices" ON public.brand_voices
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = brand_voices.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );

-- Policies for Samples (Inherit access from Voice)
DROP POLICY IF EXISTS "Org members can view samples" ON public.brand_voice_samples;
CREATE POLICY "Org members can view samples" ON public.brand_voice_samples
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_voices v
      JOIN public.organization_members om ON om.organization_id = v.organization_id
      WHERE v.id = brand_voice_samples.voice_id
      AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage samples" ON public.brand_voice_samples;
CREATE POLICY "Admins can manage samples" ON public.brand_voice_samples
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_voices v
      JOIN public.organization_members om ON om.organization_id = v.organization_id
      WHERE v.id = brand_voice_samples.voice_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;
ALTER PUBLICATION supabase_realtime ADD TABLE public.brand_voices;

-- this is batch 22 and it executed successfully




















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

-- this is batch 23 and it executed successfully





-- Workflow System Schema

-- 1. Workflows Table (Templates)
CREATE TABLE IF NOT EXISTS public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb, 
  -- Structure: [{ "id": "step1", "tool": "blog_post", "params": {...}, "input_map": {"topic": "{{step0.title}}"} }]
  is_public boolean DEFAULT false, -- If true, visible to all org members
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Workflow Executions Table (Run History)
CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES public.workflows(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id),
  status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  current_step_index integer DEFAULT 0,
  results jsonb DEFAULT '{}'::jsonb, -- Map of step_id -> output data
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- 3. RLS Policies
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

-- Workflows: Members can view, Admins can edit
CREATE POLICY "Members can view workflows" ON public.workflows
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "Admins can manage workflows" ON public.workflows
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id));

-- Executions: Members can view/create their own or org's executions
CREATE POLICY "Members can view org executions" ON public.workflow_executions
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can create executions" ON public.workflow_executions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update own executions" ON public.workflow_executions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- 4. Indexes
CREATE INDEX idx_workflows_org ON public.workflows(organization_id);
CREATE INDEX idx_executions_workflow ON public.workflow_executions(workflow_id);
CREATE INDEX idx_executions_user ON public.workflow_executions(user_id);

-- this is batch 24 and it executed successfully

















-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge Base Documents Table
CREATE TABLE IF NOT EXISTS public.knowledge_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL, -- The actual text chunk
  metadata jsonb DEFAULT '{}'::jsonb, -- Source filename, page number, etc.
  embedding vector(768), -- Gemini embeddings are 768 dimensions
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.knowledge_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org docs" ON public.knowledge_docs
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "Admins can manage org docs" ON public.knowledge_docs
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id));

-- Vector Search Function
-- Matches documents by cosine similarity
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_org_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_docs.id,
    knowledge_docs.content,
    1 - (knowledge_docs.embedding <=> query_embedding) AS similarity
  FROM knowledge_docs
  WHERE 1 - (knowledge_docs.embedding <=> query_embedding) > match_threshold
  AND knowledge_docs.organization_id = filter_org_id
  ORDER BY knowledge_docs.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Index for faster search (IVFFlat)
-- Note: This requires some data to be effective, but good to define.
-- CREATE INDEX ON knowledge_docs USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- this is batch 25 and it executed successfully

















-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge Base Documents Table
CREATE TABLE IF NOT EXISTS public.knowledge_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL, -- The actual text chunk
  metadata jsonb DEFAULT '{}'::jsonb, -- Source filename, page number, etc.
  embedding vector(768), -- Gemini embeddings are 768 dimensions
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.knowledge_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org docs" ON public.knowledge_docs
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "Admins can manage org docs" ON public.knowledge_docs
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id));

-- Vector Search Function
-- Matches documents by cosine similarity
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_org_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_docs.id,
    knowledge_docs.content,
    1 - (knowledge_docs.embedding <=> query_embedding) AS similarity
  FROM knowledge_docs
  WHERE 1 - (knowledge_docs.embedding <=> query_embedding) > match_threshold
  AND knowledge_docs.organization_id = filter_org_id
  ORDER BY knowledge_docs.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Index for faster search (IVFFlat)
-- Note: This requires some data to be effective, but good to define.
-- CREATE INDEX ON knowledge_docs USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- this is batch 26 and it didnot executed successfully. error:Error: Failed to run sql query: ERROR: 42710: policy "Members can view org docs" for table "knowledge_docs" already exists

















-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge Base Documents Table
CREATE TABLE IF NOT EXISTS public.knowledge_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL, -- The actual text chunk
  metadata jsonb DEFAULT '{}'::jsonb, -- Source filename, page number, etc.
  embedding vector(768), -- Gemini embeddings are 768 dimensions
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.knowledge_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view org docs" ON public.knowledge_docs;
CREATE POLICY "Members can view org docs" ON public.knowledge_docs
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Admins can manage org docs" ON public.knowledge_docs;
CREATE POLICY "Admins can manage org docs" ON public.knowledge_docs
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id));

-- Vector Search Function
-- Matches documents by cosine similarity
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_org_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_docs.id,
    knowledge_docs.content,
    1 - (knowledge_docs.embedding <=> query_embedding) AS similarity
  FROM knowledge_docs
  WHERE 1 - (knowledge_docs.embedding <=> query_embedding) > match_threshold
  AND knowledge_docs.organization_id = filter_org_id
  ORDER BY knowledge_docs.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- this is batch 27 and it executed successfully




















-- Agents Table
CREATE TABLE IF NOT EXISTS public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  instructions text NOT NULL, -- The custom system prompt
  model_config jsonb DEFAULT '{"model": "gemini-1.5-flash", "temperature": 0.7}'::jsonb,
  is_public boolean DEFAULT false, -- If true, visible to all org members
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Agent Chat Sessions (History)
CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Agent Messages
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

-- Agents: Members can view, Admins/Creators can edit
DROP POLICY IF EXISTS "Members can view agents" ON public.agents;
CREATE POLICY "Members can view agents" ON public.agents
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can create agents" ON public.agents;
CREATE POLICY "Members can create agents" ON public.agents
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Creators/Admins can update agents" ON public.agents;
CREATE POLICY "Creators/Admins can update agents" ON public.agents
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_org_admin(organization_id));

-- Sessions: Users can view/manage their own sessions
DROP POLICY IF EXISTS "Users manage own sessions" ON public.agent_sessions;
CREATE POLICY "Users manage own sessions" ON public.agent_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- Messages: Users manage messages in their sessions
DROP POLICY IF EXISTS "Users manage own messages" ON public.agent_messages;
CREATE POLICY "Users manage own messages" ON public.agent_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agent_sessions 
      WHERE id = agent_messages.session_id AND user_id = auth.uid()
    )
  );
-- this is batch 28 and it executed successfully



















-- Add attachments column to agent_messages to support file uploads (images/PDFs) in chat
ALTER TABLE public.agent_messages ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- this is batch 29 and it executed successfully



















-- 1. Create a table for file metadata (to group chunks)
CREATE TABLE IF NOT EXISTS public.knowledge_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Link chunks to files
ALTER TABLE public.knowledge_docs ADD COLUMN IF NOT EXISTS file_id uuid REFERENCES public.knowledge_files(id) ON DELETE CASCADE;

-- 3. Link Agents to Files (Many-to-Many via array)
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS knowledge_file_ids uuid[] DEFAULT '{}';

-- 4. RLS for new table
ALTER TABLE public.knowledge_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view files" ON public.knowledge_files FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "Admins can manage files" ON public.knowledge_files FOR ALL TO authenticated USING (public.is_org_admin(organization_id));

-- 5. Update search function to filter by file_ids
CREATE OR REPLACE FUNCTION match_documents_with_filters (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_org_id uuid,
  filter_file_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float,
  file_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_docs.id,
    knowledge_docs.content,
    1 - (knowledge_docs.embedding <=> query_embedding) AS similarity,
    knowledge_docs.file_id
  FROM knowledge_docs
  WHERE 1 - (knowledge_docs.embedding <=> query_embedding) > match_threshold
  AND knowledge_docs.organization_id = filter_org_id
  AND (filter_file_ids IS NULL OR knowledge_docs.file_id = ANY(filter_file_ids))
  ORDER BY knowledge_docs.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
-- this is batch 30 and it executed successfully
















-- Prevent duplicate agent names within an organization
ALTER TABLE public.agents ADD CONSTRAINT agents_org_name_key UNIQUE (organization_id, name);

-- Prevent duplicate knowledge file titles within an organization
ALTER TABLE public.knowledge_files ADD CONSTRAINT knowledge_files_org_title_key UNIQUE (organization_id, title);
-- this is batch 31 and it executed successfully


















-- Tags for Knowledge Files
CREATE TABLE IF NOT EXISTS public.knowledge_file_tags (
  file_id uuid REFERENCES public.knowledge_files(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (file_id, tag_id)
);

-- Tags for Workflows
CREATE TABLE IF NOT EXISTS public.workflow_tags (
  workflow_id uuid REFERENCES public.workflows(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (workflow_id, tag_id)
);

-- Tags for Agents
CREATE TABLE IF NOT EXISTS public.agent_tags (
  agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (agent_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.knowledge_file_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies (inherit access from parent objects usually, but simple org check via join is harder here without org_id on link table. 
-- Actually, standard pattern for link tables: allow all authenticated to Select/Insert/Delete if they have access to the parent.
-- Simplified: Allow authenticated users to view/manage tags. The logic is enforced by API which checks org membership.)

CREATE POLICY "Allow all for auth users on knowledge_file_tags" ON public.knowledge_file_tags FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for auth users on workflow_tags" ON public.workflow_tags FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for auth users on agent_tags" ON public.agent_tags FOR ALL TO authenticated USING (true);

-- this is batch 32 and it executed successfully







-- API Keys for Embeddable Chatbot
CREATE TABLE IF NOT EXISTS public.organization_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  public_key text NOT NULL UNIQUE,
  secret_key text UNIQUE, 
  name text NOT NULL,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

-- Enable RLS
ALTER TABLE public.organization_api_keys ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Org members can view keys" ON public.organization_api_keys;
CREATE POLICY "Org members can view keys" ON public.organization_api_keys
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Org admins can manage keys" ON public.organization_api_keys;
CREATE POLICY "Org admins can manage keys" ON public.organization_api_keys
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id));

-- Index for fast lookup during API calls
CREATE INDEX IF NOT EXISTS idx_api_keys_public_key ON public.organization_api_keys(public_key);

-- this is batch 33 and it executed successfully








-- Support for Lead Capture and Metadata in Embed Chat
ALTER TABLE public.agent_sessions 
ADD COLUMN IF NOT EXISTS customer_email text,
ADD COLUMN IF NOT EXISTS customer_name text,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Index for looking up leads
CREATE INDEX IF NOT EXISTS idx_agent_sessions_email ON public.agent_sessions(customer_email);

-- this is batch 34 and it executed successfully




















-- Models Configuration Table
CREATE TABLE IF NOT EXISTS public.ai_models (
    id text PRIMARY KEY, -- e.g. 'openai/gpt-4o'
    name text NOT NULL,
    provider text NOT NULL DEFAULT 'openrouter', -- 'openrouter', 'google'
    context_length int DEFAULT 4096,
    credit_multiplier numeric(10, 2) DEFAULT 1.0, -- 1.0 = standard cost, 2.0 = double cost
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;

-- Everyone can read active models
CREATE POLICY "Everyone can view active models" ON public.ai_models
    FOR SELECT USING (is_active = true);

-- Only admins can modify (assuming you have admin policies, otherwise manual insert)

-- Seed Initial Data (OpenRouter Models)
INSERT INTO public.ai_models (id, name, provider, context_length, credit_multiplier) VALUES
('google/gemini-2.0-flash-exp:free', 'Gemini 2.0 Flash (Free)', 'openrouter', 32000, 0.5),
('openai/gpt-4o', 'GPT-4o', 'openrouter', 128000, 10.0),
('openai/gpt-4o-mini', 'GPT-4o Mini', 'openrouter', 128000, 1.0),
('anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet', 'openrouter', 200000, 5.0),
('meta-llama/llama-3.1-70b-instruct', 'Llama 3.1 70B', 'openrouter', 128000, 1.5),
('mistralai/mistral-large', 'Mistral Large', 'openrouter', 32000, 3.0)
ON CONFLICT (id) DO UPDATE 
SET credit_multiplier = EXCLUDED.credit_multiplier;

-- this is batch 35 and it executed successfully





















-- Zapier Subscriptions (Webhooks)
CREATE TABLE IF NOT EXISTS public.zapier_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    event text NOT NULL, -- 'workflow_completed', 'lead_captured'
    target_url text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.zapier_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users manage own hooks" ON public.zapier_subscriptions
    FOR ALL USING (auth.uid() = user_id);

-- OAuth Codes (Temporary storage for auth flow)
CREATE TABLE IF NOT EXISTS public.oauth_codes (
    code text PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- OAuth Access Tokens
CREATE TABLE IF NOT EXISTS public.oauth_access_tokens (
    access_token text PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- this is batch 36 and it executed successfully









-- Add new metadata columns
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS category text DEFAULT 'Standard';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS speed text DEFAULT 'Medium';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS cost text DEFAULT 'Medium';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS best_for text DEFAULT '';

-- Clear old data
TRUNCATE TABLE public.ai_models;

-- Insert new models
INSERT INTO public.ai_models (id, name, provider, category, context_length, credit_multiplier, speed, cost, best_for) VALUES
('openai/gpt-5.1', 'GPT-5.1 (Latest & Most Advanced)', 'openrouter', 'Premium', 128000, 4.5, 'Fast', 'High', 'Complex reasoning, advanced writing'),
('openai/gpt-4.1', 'GPT-4.1 (Industry Standard)', 'openrouter', 'Advanced', 128000, 3.0, 'Medium', 'Medium', 'Professional writing, general content'),
('openai/gpt-4o-mini', 'GPT-4o Mini (Fast & Affordable)', 'openrouter', 'Standard', 128000, 1.5, 'Very Fast', 'Low', 'Quick summaries, edits, suggestions'),

('anthropic/claude-4-sonnet', 'Claude 4 Sonnet (Creative)', 'openrouter', 'Advanced', 200000, 2.5, 'Medium', 'Medium', 'Creative writing, nuanced content'),
('anthropic/claude-3.7-opus', 'Claude 3.7 Opus (Deep Reasoning)', 'openrouter', 'Premium', 200000, 5.0, 'Slow', 'High', 'Complex analysis, long-form writing'),

('google/gemini-2.5-pro', 'Gemini 2.5 Pro (Reasoning)', 'openrouter', 'Advanced', 1000000, 2.0, 'Fast', 'Medium', 'Long documents, multimodal content'),
('google/gemini-2.0-flash-001', 'Gemini 2.0 Flash (Speed Champion)', 'google', 'Standard', 1000000, 1.0, 'Very Fast', 'Low', 'Real-time generation');

-- this is batch 37 and it executed successfully




















-- Add new metadata columns
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS category text DEFAULT 'Standard';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS speed text DEFAULT 'Medium';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS cost text DEFAULT 'Medium';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS best_for text DEFAULT '';

-- Clear old data
TRUNCATE TABLE public.ai_models;

-- Insert new models
INSERT INTO public.ai_models (id, name, provider, category, context_length, credit_multiplier, speed, cost, best_for) VALUES
('openai/gpt-4o', 'GPT-4o (Smartest)', 'openrouter', 'Premium', 128000, 3.0, 'Fast', 'High', 'Complex reasoning, coding, advanced writing'),
('openai/gpt-4o-mini', 'GPT-4o Mini (Fast)', 'openrouter', 'Standard', 128000, 1.0, 'Very Fast', 'Low', 'Quick summaries, chat, edits'),

('anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet', 'openrouter', 'Advanced', 200000, 1.5, 'Medium', 'Medium', 'Creative writing, coding, nuanced tone'),
('anthropic/claude-3-opus', 'Claude 3 Opus', 'openrouter', 'Premium', 200000, 7.5, 'Slow', 'Very High', 'Complex analysis, heavy reasoning'),

('google/gemini-pro-1.5', 'Gemini 1.5 Pro', 'openrouter', 'Advanced', 2000000, 2.0, 'Medium', 'Medium', 'Long documents, massive context analysis'),
('google/gemini-flash-1.5', 'Gemini 1.5 Flash', 'google', 'Standard', 1000000, 0.5, 'Very Fast', 'Very Low', 'Real-time generation, high volume');

-- this is batch 38 and it executed successfully






















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
-- this is batch 39 and it executed successfully

































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
-- this is batch 40 and it executed successfully



















-- Update Available Models with Extended List (GPT-5, Claude 4.5, etc.)

-- Add new metadata columns if missing
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS category text DEFAULT 'Standard';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS speed text DEFAULT 'Medium';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS cost text DEFAULT 'Medium';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS best_for text DEFAULT '';

-- Clear old data
TRUNCATE TABLE public.ai_models;

-- Insert New Models
INSERT INTO public.ai_models (id, name, provider, category, context_length, credit_multiplier, speed, cost, best_for) VALUES
-- OpenAI
('openai/gpt-5.1', 'GPT-5.1 (Frontier)', 'openrouter', 'Premium', 128000, 6.0, 'Fast', 'High', 'Complex reasoning, advanced creation'),
('openai/gpt-5.1-chat', 'GPT-5.1 Chat', 'openrouter', 'Advanced', 128000, 3.0, 'Very Fast', 'Medium', 'Interactive chat, high throughput'),
('openai/gpt-5-pro', 'GPT-5 Pro', 'openrouter', 'Premium', 128000, 5.0, 'Medium', 'High', 'Deep reasoning, critical tasks'),
('openai/gpt-5', 'GPT-5', 'openrouter', 'Premium', 128000, 4.0, 'Fast', 'High', 'General purpose advanced tasks'),
('openai/gpt-5-mini', 'GPT-5 Mini', 'openrouter', 'Standard', 128000, 1.0, 'Very Fast', 'Low', 'Quick tasks, cost effective'),
('openai/gpt-5-nano', 'GPT-5 Nano', 'openrouter', 'Standard', 128000, 0.5, 'Ultra Fast', 'Very Low', 'Real-time, edge cases'),
('openai/gpt-4.1', 'GPT-4.1', 'openrouter', 'Advanced', 128000, 2.0, 'Fast', 'Medium', 'Reliable reasoning'),
('openai/gpt-4.1-mini', 'GPT-4.1 Mini', 'openrouter', 'Standard', 128000, 0.8, 'Very Fast', 'Low', 'General lightweight tasks'),
('openai/gpt-4.1-nano', 'GPT-4.1 Nano', 'openrouter', 'Standard', 128000, 0.4, 'Ultra Fast', 'Very Low', 'Fastest responses'),

-- Anthropic
('anthropic/claude-opus-4.5', 'Claude 4.5 Opus', 'openrouter', 'Premium', 200000, 8.0, 'Slow', 'Very High', 'Maximum intelligence, heavy research'),
('anthropic/claude-sonnet-4.5', 'Claude 4.5 Sonnet', 'openrouter', 'Advanced', 200000, 3.0, 'Medium', 'High', 'Coding, nuanced writing'),
('anthropic/claude-haiku-4.5', 'Claude 4.5 Haiku', 'openrouter', 'Standard', 200000, 1.0, 'Fast', 'Low', 'Fast, smart interactions'),
('anthropic/claude-opus-4.1', 'Claude 4.1 Opus', 'openrouter', 'Premium', 200000, 6.0, 'Slow', 'High', 'Deep analysis'),
('anthropic/claude-opus-4', 'Claude 4 Opus', 'openrouter', 'Premium', 200000, 5.0, 'Slow', 'High', 'Complex reasoning'),
('anthropic/claude-sonnet-4-0', 'Claude 4 Sonnet', 'openrouter', 'Advanced', 200000, 2.0, 'Medium', 'Medium', 'Daily driver, coding'),
('anthropic/claude-3.7-sonnet', 'Claude 3.7 Sonnet', 'openrouter', 'Advanced', 200000, 1.5, 'Medium', 'Medium', 'High quality writing'),
('anthropic/claude-3.7-sonnet:thinking', 'Claude 3.7 Sonnet (Thinking)', 'openrouter', 'Advanced', 200000, 1.5, 'Slow', 'Medium', 'Extended reasoning'),
('anthropic/claude-3.5-haiku-20241022', 'Claude 3.5 Haiku', 'openrouter', 'Standard', 200000, 0.5, 'Very Fast', 'Low', 'Speed and efficiency'),

-- Gemini
('google/gemini-3-pro-preview', 'Gemini 3 Pro (Preview)', 'openrouter', 'Premium', 2000000, 3.0, 'Fast', 'High', 'Multimodal, frontier tasks'),
('google/gemini-2.5-pro', 'Gemini 2.5 Pro', 'openrouter', 'Premium', 2000000, 2.5, 'Fast', 'Medium', 'Deep reasoning, multimodal'),
('google/gemini-2.5-flash', 'Gemini 2.5 Flash', 'openrouter', 'Standard', 1000000, 1.0, 'Very Fast', 'Low', 'High volume, fast tasks'),
('google/gemini-2.0-flash-001', 'Gemini 2.0 Flash', 'openrouter', 'Standard', 1000000, 0.5, 'Very Fast', 'Very Low', 'Real-time generation');

-- this is batch 41 and it executed successfully




















-- Update Available Models with Extended List (OpenAI o3/o4, GPT-5, Claude 4.5, etc.)

-- Add new metadata columns if missing
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS category text DEFAULT 'Standard';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS speed text DEFAULT 'Medium';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS cost text DEFAULT 'Medium';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS best_for text DEFAULT '';

-- Clear old data
TRUNCATE TABLE public.ai_models;

-- Insert New Models
INSERT INTO public.ai_models (id, name, provider, category, context_length, credit_multiplier, speed, cost, best_for) VALUES
-- OpenAI
('openai/gpt-5.1', 'GPT-5.1 (Frontier)', 'openrouter', 'Premium', 128000, 6.0, 'Fast', 'High', 'Complex reasoning, advanced creation'),
('openai/gpt-5.1-chat', 'GPT-5.1 Chat', 'openrouter', 'Advanced', 128000, 3.0, 'Very Fast', 'Medium', 'Interactive chat, high throughput'),
('openai/gpt-5-pro', 'GPT-5 Pro', 'openrouter', 'Premium', 128000, 5.0, 'Medium', 'High', 'Deep reasoning, critical tasks'),
('openai/gpt-5', 'GPT-5', 'openrouter', 'Premium', 128000, 4.0, 'Fast', 'High', 'General purpose advanced tasks'),
('openai/gpt-5-mini', 'GPT-5 Mini', 'openrouter', 'Standard', 128000, 1.0, 'Very Fast', 'Low', 'Quick tasks, cost effective'),
('openai/gpt-5-nano', 'GPT-5 Nano', 'openrouter', 'Standard', 128000, 0.5, 'Ultra Fast', 'Very Low', 'Real-time, edge cases'),

('openai/o3-deep-research', 'o3 Deep Research', 'openrouter', 'Premium', 128000, 8.0, 'Slow', 'Very High', 'Extensive research, deep analysis'),
('openai/o4-mini-deep-research', 'o4 Mini Deep Research', 'openrouter', 'Advanced', 128000, 2.5, 'Medium', 'Medium', 'Research on a budget'),
('openai/o3-pro', 'o3 Pro', 'openrouter', 'Premium', 128000, 6.0, 'Medium', 'High', 'Professional reasoning tasks'),
('openai/o4-mini-high', 'o4 Mini High', 'openrouter', 'Advanced', 128000, 1.5, 'Fast', 'Medium', 'High capability small model'),
('openai/o4-mini', 'o4 Mini', 'openrouter', 'Standard', 128000, 1.0, 'Very Fast', 'Low', 'Everyday reasoning'),
('openai/o3-mini-high', 'o3 Mini High', 'openrouter', 'Advanced', 128000, 2.0, 'Fast', 'Medium', 'Balanced reasoning'),
('openai/gpt-4o-2024-11-20', 'GPT-4o (Nov 2024)', 'openrouter', 'Premium', 128000, 3.0, 'Fast', 'High', 'Creative writing, latest capabilities'),
('openai/gpt-4o-mini', 'GPT-4o Mini', 'openrouter', 'Standard', 128000, 0.8, 'Very Fast', 'Low', 'Quick summaries, chat, edits'),

('openai/gpt-4.1', 'GPT-4.1', 'openrouter', 'Advanced', 128000, 2.0, 'Fast', 'Medium', 'Reliable reasoning'),
('openai/gpt-4.1-mini', 'GPT-4.1 Mini', 'openrouter', 'Standard', 128000, 0.8, 'Very Fast', 'Low', 'General lightweight tasks'),
('openai/gpt-4.1-nano', 'GPT-4.1 Nano', 'openrouter', 'Standard', 128000, 0.4, 'Ultra Fast', 'Very Low', 'Fastest responses'),

-- Anthropic
('anthropic/claude-opus-4.5', 'Claude 4.5 Opus', 'openrouter', 'Premium', 200000, 8.0, 'Slow', 'Very High', 'Maximum intelligence, heavy research'),
('anthropic/claude-sonnet-4.5', 'Claude 4.5 Sonnet', 'openrouter', 'Advanced', 200000, 3.0, 'Medium', 'High', 'Coding, nuanced writing'),
('anthropic/claude-haiku-4.5', 'Claude 4.5 Haiku', 'openrouter', 'Standard', 200000, 1.0, 'Fast', 'Low', 'Fast, smart interactions'),
('anthropic/claude-opus-4.1', 'Claude 4.1 Opus', 'openrouter', 'Premium', 200000, 6.0, 'Slow', 'High', 'Deep analysis'),
('anthropic/claude-opus-4', 'Claude 4 Opus', 'openrouter', 'Premium', 200000, 5.0, 'Slow', 'High', 'Complex reasoning'),
('anthropic/claude-sonnet-4-0', 'Claude 4 Sonnet', 'openrouter', 'Advanced', 200000, 2.0, 'Medium', 'Medium', 'Daily driver, coding'),
('anthropic/claude-3.7-sonnet', 'Claude 3.7 Sonnet', 'openrouter', 'Advanced', 200000, 1.5, 'Medium', 'Medium', 'High quality writing'),
('anthropic/claude-3.7-sonnet:thinking', 'Claude 3.7 Sonnet (Thinking)', 'openrouter', 'Advanced', 200000, 1.5, 'Slow', 'Medium', 'Extended reasoning'),

-- Gemini
('google/gemini-3-pro-preview', 'Gemini 3 Pro (Preview)', 'openrouter', 'Premium', 2000000, 3.0, 'Fast', 'High', 'Multimodal, frontier tasks'),
('google/gemini-2.5-pro', 'Gemini 2.5 Pro', 'openrouter', 'Premium', 2000000, 2.5, 'Fast', 'Medium', 'Deep reasoning, multimodal'),
('google/gemini-2.5-flash', 'Gemini 2.5 Flash', 'openrouter', 'Standard', 1000000, 1.0, 'Very Fast', 'Low', 'High volume, fast tasks'),
('google/gemini-2.0-flash-001', 'Gemini 2.0 Flash', 'openrouter', 'Standard', 1000000, 0.5, 'Very Fast', 'Very Low', 'Real-time generation');

-- this is batch 42 and it executed successfully























-- Create credits_transactions table for tracking purchases and history
CREATE TABLE IF NOT EXISTS credits_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID, -- Optional, if credits are linked to org
  amount_cents INTEGER NOT NULL,
  credits_added INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
  stripe_session_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create credit_deductions table (used by record_usage) if not exists
CREATE TABLE IF NOT EXISTS credit_deductions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID,
  amount_credits INTEGER,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for analytics
CREATE INDEX IF NOT EXISTS idx_credits_transactions_user_id ON credits_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_transactions_org_id ON credits_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_credits_transactions_created_at ON credits_transactions(created_at);

-- Function to add credits to organization (since app uses org-based credits)
CREATE OR REPLACE FUNCTION fulfill_checkout(session_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tx_record RECORD;
  org_id UUID;
  new_balance BIGINT;
BEGIN
  -- 1. Find the transaction
  SELECT * INTO tx_record
  FROM credits_transactions
  WHERE stripe_session_id = session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Transaction not found');
  END IF;

  IF tx_record.status = 'completed' THEN
    RETURN jsonb_build_object('status', 'already_completed');
  END IF;

  -- 2. Determine Organization (default to user's primary org if not specified)
  IF tx_record.organization_id IS NULL THEN
     SELECT organization_id INTO org_id
     FROM organization_members
     WHERE user_id = tx_record.user_id
     ORDER BY created_at ASC
     LIMIT 1;
  ELSE
     org_id := tx_record.organization_id;
  END IF;

  IF org_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No organization found for user');
  END IF;

  -- 3. Update Transaction Status
  UPDATE credits_transactions
  SET 
    status = 'completed',
    organization_id = org_id,
    updated_at = now()
  WHERE id = tx_record.id;

  -- 4. Add Credits to Organization Balance
  INSERT INTO organization_credits (organization_id, balance_credits)
  VALUES (org_id, tx_record.credits_added)
  ON CONFLICT (organization_id)
  DO UPDATE SET
    balance_credits = organization_credits.balance_credits + EXCLUDED.balance_credits,
    updated_at = now()
  RETURNING balance_credits INTO new_balance;

  RETURN jsonb_build_object(
    'status', 'success',
    'credits_added', tx_record.credits_added,
    'new_balance', new_balance,
    'organization_id', org_id
  );
END;
$$;

-- this is batch 43 and it didn't executed successfully
--Error: Failed to run sql query: ERROR: 42703: column "organization_id" does not exist


















-- Fix missing organization_id in credits_transactions if table exists from partial run
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'credits_transactions'
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE credits_transactions ADD COLUMN organization_id UUID;
    END IF;
END $$;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_credits_transactions_org_id ON credits_transactions(organization_id);

-- Re-run the table creations to ensure they exist (idempotent)
CREATE TABLE IF NOT EXISTS credit_deductions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID,
  amount_credits INTEGER,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Re-define the function to ensure it matches table schema
CREATE OR REPLACE FUNCTION fulfill_checkout(session_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tx_record RECORD;
  org_id UUID;
  new_balance BIGINT;
BEGIN
  -- 1. Find the transaction
  SELECT * INTO tx_record
  FROM credits_transactions
  WHERE stripe_session_id = session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Transaction not found');
  END IF;

  IF tx_record.status = 'completed' THEN
    RETURN jsonb_build_object('status', 'already_completed');
  END IF;

  -- 2. Determine Organization (default to user's primary org if not specified)
  IF tx_record.organization_id IS NULL THEN
     SELECT organization_id INTO org_id
     FROM organization_members
     WHERE user_id = tx_record.user_id
     ORDER BY created_at ASC
     LIMIT 1;
  ELSE
     org_id := tx_record.organization_id;
  END IF;

  IF org_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No organization found for user');
  END IF;

  -- 3. Update Transaction Status
  UPDATE credits_transactions
  SET 
    status = 'completed',
    organization_id = org_id,
    updated_at = now()
  WHERE id = tx_record.id;

  -- 4. Add Credits to Organization Balance
  INSERT INTO organization_credits (organization_id, balance_credits)
  VALUES (org_id, tx_record.credits_added)
  ON CONFLICT (organization_id)
  DO UPDATE SET
    balance_credits = organization_credits.balance_credits + EXCLUDED.balance_credits,
    updated_at = now()
  RETURNING balance_credits INTO new_balance;

  RETURN jsonb_build_object(
    'status', 'success',
    'credits_added', tx_record.credits_added,
    'new_balance', new_balance,
    'organization_id', org_id
  );
END;
$$;
-- this is batch 44 and it executed successfully



















-- Ensure usage_events table exists
CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid,
  tool text,
  provider text,
  action text,
  units numeric,
  cost_usd numeric(12,4) DEFAULT 0,
  credits integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_usage_events_org ON public.usage_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON public.usage_events(created_at);

-- Ensure organization_credits exists
CREATE TABLE IF NOT EXISTS public.organization_credits (
  organization_id uuid PRIMARY KEY,
  balance_credits bigint NOT NULL DEFAULT 0,
  meter_usd numeric(12,4) NOT NULL DEFAULT 0,
  total_spent_usd numeric(12,4) NOT NULL DEFAULT 0,
  total_deducted_credits bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure record_usage function exists
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
  organization_id uuid,
  balance_credits bigint
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
  RETURN QUERY SELECT v_org_credits.organization_id, v_org_credits.balance_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- this is batch 45 and it executed successfully



















-- Fix ambiguous column reference in record_usage function
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
  -- Check if table exists dynamically or just insert (assuming it exists from previous steps)
  INSERT INTO public.credit_deductions(organization_id, amount_credits, reason)
  VALUES (p_organization_id, p_credits, CONCAT('Usage: ', p_tool));

  -- 5. Return new balance
  SELECT * INTO v_org_credits FROM public.organization_credits WHERE organization_id = p_organization_id;
  
  res_organization_id := v_org_credits.organization_id;
  res_balance_credits := v_org_credits.balance_credits;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
 -- this is batch 46 and it didnot executed successfully
 --Error: Failed to run sql query: ERROR: 42P13: cannot change return type of existing function DETAIL: Row type defined by OUT parameters is different. HINT: Use DROP FUNCTION record_usage(uuid,uuid,text,text,text,numeric,integer,jsonb) first.
 




































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
-- this is batch 47 and it executed successfully




















CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL, -- e.g. 'pro', 'business', 'agency'
  name text NOT NULL,
  description text,
  monthly_price_cents integer NOT NULL,
  yearly_price_cents integer,
  included_credits_per_month integer NOT NULL,
  seat_limit integer NOT NULL,
  stripe_monthly_price_id text,
  stripe_yearly_price_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active subscription plans" ON public.subscription_plans
  FOR SELECT USING (is_active = true);

INSERT INTO public.subscription_plans (code, name, description, monthly_price_cents, yearly_price_cents, included_credits_per_month, seat_limit, is_active)
VALUES
  ('pro', 'Pro', 'For small teams getting started with WriterVerse Hub', 4900, 42000, 50000, 5, true),
  ('business', 'Business', 'For growing teams that need analytics and integrations', 14900, 144000, 200000, 15, true),
  ('agency', 'Agency', 'For larger organizations and agencies with higher volume needs', 29900, 288000, 500000, 30, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  yearly_price_cents = EXCLUDED.yearly_price_cents,
  included_credits_per_month = EXCLUDED.included_credits_per_month,
  seat_limit = EXCLUDED.seat_limit,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id),
  plan_code text,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'trialing',
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  trial_credits_granted boolean DEFAULT false,
  last_metered_period_start timestamptz,
  last_metered_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_subscriptions_org_unique UNIQUE (organization_id)
);

ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view subscriptions" ON public.organization_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "Org admins can manage subscriptions" ON public.organization_subscriptions
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id));

  -- this is batch 48 and it didnot executed successfully
  -- error: Error: Failed to run sql query: ERROR: 42710: policy "Everyone can view active subscription plans" for table "subscription_plans" already exists


















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

-- this is batch 49 and it executed successfully



















-- SQL48_add_created_by_to_projects.sql
-- Add created_by column to projects table if it doesn't exist

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'projects'
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.projects
        ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- this is batch 50 and it executed successfully























-- SQL49_add_type_to_tags.sql
-- Add type column to tags table if it doesn't exist

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tags'
        AND column_name = 'type'
    ) THEN
        ALTER TABLE public.tags
        ADD COLUMN type text NOT NULL DEFAULT 'project';
    END IF;
END $$;
-- this is batch 51 and it executed successfully



















DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tags'
        AND column_name = 'color'
    ) THEN
        ALTER TABLE public.tags
        ADD COLUMN color text DEFAULT '#94a3b8';
    END IF;
END $$;

-- this is batch 52 and it executed successfully























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

-- this is batch 53 and it executed successfully



















-- Composio Integration Tables for WriterAI
-- Run this migration to enable agent/tool integrations

-- ============================================
-- Table: agent_integrations
-- Stores which Composio apps are connected for each agent
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Composio connection info
  app_name VARCHAR(100) NOT NULL,  -- e.g., 'SLACK', 'GMAIL', 'NOTION'
  connection_id VARCHAR(255),       -- Composio's connection ID
  connection_status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'connected', 'error', 'revoked'
  
  -- Metadata
  connected_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique connection per agent/app
  UNIQUE(agent_id, app_name)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_agent_integrations_agent ON public.agent_integrations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_integrations_org ON public.agent_integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_integrations_status ON public.agent_integrations(connection_status);

-- ============================================
-- Table: tool_executions
-- Logs all tool/action executions for debugging and analytics
-- ============================================
CREATE TABLE IF NOT EXISTS public.tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Execution context
  source_type VARCHAR(50) NOT NULL,  -- 'agent', 'workflow', 'tool'
  source_id UUID,                     -- agent_id, workflow_id, or null for direct tool
  source_name VARCHAR(255),           -- Human-readable name
  
  -- Tool info
  tool_name VARCHAR(255) NOT NULL,    -- e.g., 'SLACK_SEND_MESSAGE'
  app_name VARCHAR(100),              -- e.g., 'SLACK'
  
  -- Execution details
  input_params JSONB,                 -- Parameters sent to tool
  output_result JSONB,                -- Result from tool
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- 'pending', 'success', 'error'
  error_message TEXT,
  error_code VARCHAR(100),
  
  -- Performance
  execution_time_ms INTEGER,
  
  -- Timestamps
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_tool_executions_org ON public.tool_executions(organization_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_source ON public.tool_executions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool ON public.tool_executions(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_executions_status ON public.tool_executions(status);
CREATE INDEX IF NOT EXISTS idx_tool_executions_date ON public.tool_executions(executed_at);

-- ============================================
-- Table: workflow_integrations  
-- Stores output destinations for workflow steps
-- ============================================
CREATE TABLE IF NOT EXISTS public.workflow_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Configuration
  step_id VARCHAR(100),               -- Which step triggers this (null = on completion)
  app_name VARCHAR(100) NOT NULL,     -- Target app
  action_name VARCHAR(255) NOT NULL,  -- Action to execute
  action_params JSONB,                -- Static params + variable mappings
  
  -- Status
  is_enabled BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_integrations_workflow ON public.workflow_integrations(workflow_id);

-- ============================================
-- Enable RLS (Row Level Security)
-- ============================================
ALTER TABLE public.agent_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_integrations
CREATE POLICY "Users can view own org integrations" ON public.agent_integrations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own org integrations" ON public.agent_integrations
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for tool_executions
CREATE POLICY "Users can view own org executions" ON public.tool_executions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for workflow_integrations  
CREATE POLICY "Users can view own org workflow integrations" ON public.workflow_integrations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own org workflow integrations" ON public.workflow_integrations
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Helper function to log tool execution
-- ============================================
CREATE OR REPLACE FUNCTION public.log_tool_execution(
  p_organization_id UUID,
  p_user_id UUID,
  p_source_type VARCHAR(50),
  p_source_id UUID,
  p_source_name VARCHAR(255),
  p_tool_name VARCHAR(255),
  p_app_name VARCHAR(100),
  p_input_params JSONB,
  p_output_result JSONB,
  p_status VARCHAR(50),
  p_error_message TEXT DEFAULT NULL,
  p_error_code VARCHAR(100) DEFAULT NULL,
  p_execution_time_ms INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.tool_executions (
    organization_id, user_id, source_type, source_id, source_name,
    tool_name, app_name, input_params, output_result, status,
    error_message, error_code, execution_time_ms
  ) VALUES (
    p_organization_id, p_user_id, p_source_type, p_source_id, p_source_name,
    p_tool_name, p_app_name, p_input_params, p_output_result, p_status,
    p_error_message, p_error_code, p_execution_time_ms
  ) RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.log_tool_execution TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_tool_execution TO service_role;
-- this is batch 54 and it executed successfully



















-- Make user_id optional
ALTER TABLE public.agent_integrations 
ALTER COLUMN user_id DROP NOT NULL;
-- this is batch 55 and it executed successfully

















-- Add metadata column to agent_messages to support tool usage tracking
ALTER TABLE public.agent_messages ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
-- this is batch 56 and it executed successfully




















-- Support for Human Escalation Workflow
-- Adds status column to track if a session is active (AI replying), escalated (Human replying), or closed.

ALTER TABLE public.agent_sessions 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'escalated', 'closed'));

-- Index for faster inbox queries
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON public.agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_updated_at ON public.agent_sessions(updated_at DESC);

-- Allow support team (org members) to view all sessions for their org
-- (Existing policies might restrict to own sessions, need to broaden for support)

-- Update policy for Members to see ALL sessions in their org (for Inbox)
-- First check existing policies on agent_sessions
DROP POLICY IF EXISTS "Users manage own sessions" ON public.agent_sessions;

-- New Policy: Users can see their own sessions, OR org members can see sessions for agents in their org
CREATE POLICY "Users and Support view sessions" ON public.agent_sessions
FOR ALL TO authenticated
USING (
    user_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM public.agents a
        WHERE a.id = agent_sessions.agent_id 
        AND public.is_org_member(a.organization_id)
    )
);

-- Need similar policy for messages to allow Support to read/reply
DROP POLICY IF EXISTS "Users manage own messages" ON public.agent_messages;

CREATE POLICY "Users and Support view messages" ON public.agent_messages
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.agent_sessions s
        JOIN public.agents a ON a.id = s.agent_id
        WHERE s.id = agent_messages.session_id
        AND (
            s.user_id = auth.uid() OR -- The user who started the chat
            public.is_org_member(a.organization_id) -- Support team
        )
    )
);
-- this is batch 57 and it executed successfully























-- Fixes for Lead Capture and Message Persistence

-- 1. Support for Lead Capture in Widget
ALTER TABLE public.agent_sessions 
ADD COLUMN IF NOT EXISTS customer_email text,
ADD COLUMN IF NOT EXISTS customer_name text,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 2. Support for Human Replies (tracking who replied)
ALTER TABLE public.agent_messages 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Index for faster lookup of customer sessions
CREATE INDEX IF NOT EXISTS idx_agent_sessions_email ON public.agent_sessions(customer_email);
-- this is batch 58 and it executed successfully




















-- Add widget_settings column to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS widget_settings JSONB DEFAULT '{}'::jsonb;

-- Create storage bucket for chat attachments if it doesn't exist
-- Note: Bucket creation usually requires Supabase UI or generic API, but we can try inserting into storage.buckets if permissions allow.
-- For safety, we will assume the user or a separate process sets up the 'chat-attachments' bucket, 
-- or we handle it via the JS client if using the service role.
-- this is batch 59 and it executed successfully
































-- SQL57: Fix fulfill_checkout to auto-create organization if user doesn't have one
-- Run this in Supabase SQL Editor

-- Drop and recreate the function with auto-org creation
CREATE OR REPLACE FUNCTION fulfill_checkout(session_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tx_record RECORD;
  org_id UUID;
  new_balance BIGINT;
  user_email TEXT;
BEGIN
  -- 1. Find the transaction
  SELECT * INTO tx_record
  FROM credits_transactions
  WHERE stripe_session_id = session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Transaction not found');
  END IF;

  IF tx_record.status = 'completed' THEN
    RETURN jsonb_build_object('status', 'already_completed');
  END IF;

  -- 2. Determine Organization (default to user's primary org if not specified)
  IF tx_record.organization_id IS NOT NULL THEN
    org_id := tx_record.organization_id;
  ELSE
    -- Try to find existing organization membership
    SELECT om.organization_id INTO org_id
    FROM organization_members om
    WHERE om.user_id = tx_record.user_id
    ORDER BY om.created_at ASC
    LIMIT 1;
    
    -- If no organization found, auto-create one for the user
    IF org_id IS NULL THEN
      -- Get user email for naming the workspace
      SELECT email INTO user_email FROM auth.users WHERE id = tx_record.user_id;
      IF user_email IS NULL THEN
        user_email := 'User';
      END IF;
      
      -- Create a personal workspace
      INSERT INTO organizations (name, seat_limit)
      VALUES (split_part(user_email, '@', 1) || '''s Workspace', 1)
      RETURNING id INTO org_id;
      
      -- Add user as owner of this organization
      INSERT INTO organization_members (organization_id, user_id, role)
      VALUES (org_id, tx_record.user_id, 'owner');
      
      -- Initialize organization credits
      INSERT INTO organization_credits (organization_id, balance_credits)
      VALUES (org_id, 0)
      ON CONFLICT (organization_id) DO NOTHING;
    END IF;
  END IF;

  -- 3. Update Transaction Status
  UPDATE credits_transactions
  SET 
    status = 'completed',
    organization_id = org_id,
    updated_at = now()
  WHERE id = tx_record.id;

  -- 4. Add Credits to Organization Balance
  INSERT INTO organization_credits (organization_id, balance_credits)
  VALUES (org_id, tx_record.credits_added)
  ON CONFLICT (organization_id)
  DO UPDATE SET
    balance_credits = organization_credits.balance_credits + EXCLUDED.balance_credits,
    updated_at = now()
  RETURNING balance_credits INTO new_balance;

  RETURN jsonb_build_object(
    'status', 'success',
    'credits_added', tx_record.credits_added,
    'new_balance', new_balance,
    'organization_id', org_id
  );
END;
$$;

-- Ensure RLS doesn't block the function
GRANT EXECUTE ON FUNCTION fulfill_checkout(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fulfill_checkout(TEXT) TO service_role;



















CREATE OR REPLACE FUNCTION fulfill_checkout(session_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tx_record RECORD;
  org_id UUID;
  new_balance BIGINT;
  user_email TEXT;
BEGIN
  SELECT * INTO tx_record FROM credits_transactions WHERE stripe_session_id = session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Transaction not found'); END IF;
  IF tx_record.status = 'completed' THEN RETURN jsonb_build_object('status', 'already_completed'); END IF;

  IF tx_record.organization_id IS NOT NULL THEN
    org_id := tx_record.organization_id;
  ELSE
    SELECT om.organization_id INTO org_id FROM organization_members om WHERE om.user_id = tx_record.user_id ORDER BY om.created_at ASC LIMIT 1;
    
    IF org_id IS NULL THEN
      SELECT email INTO user_email FROM auth.users WHERE id = tx_record.user_id;
      INSERT INTO organizations (name, seat_limit) VALUES (COALESCE(split_part(user_email, '@', 1), 'User') || '''s Workspace', 1) RETURNING id INTO org_id;
      INSERT INTO organization_members (organization_id, user_id, role) VALUES (org_id, tx_record.user_id, 'owner');
      INSERT INTO organization_credits (organization_id, balance_credits) VALUES (org_id, 0) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Fixed: removed updated_at column reference
  UPDATE credits_transactions SET status = 'completed', organization_id = org_id WHERE id = tx_record.id;
  
  INSERT INTO organization_credits (organization_id, balance_credits) VALUES (org_id, tx_record.credits_added)
  ON CONFLICT (organization_id) DO UPDATE SET balance_credits = organization_credits.balance_credits + EXCLUDED.balance_credits, updated_at = now()
  RETURNING balance_credits INTO new_balance;

  RETURN jsonb_build_object('status', 'success', 'credits_added', tx_record.credits_added, 'new_balance', new_balance, 'organization_id', org_id);
END;
$$;

















-- SQL58: Create chat-attachments storage bucket for widget file uploads
-- Run this in Supabase SQL Editor

-- 1. Create the storage bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-attachments',
    'chat-attachments', 
    true,  -- Make it public
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']::text[];

-- 2. Create policy for public read access
CREATE POLICY IF NOT EXISTS "Public read access for chat-attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-attachments');

-- 3. Create policy for authenticated uploads (service role)
CREATE POLICY IF NOT EXISTS "Service role can upload to chat-attachments"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'chat-attachments');

-- If you get errors about policies already existing, run these instead:
-- DROP POLICY IF EXISTS "Public read access for chat-attachments" ON storage.objects;
-- DROP POLICY IF EXISTS "Service role can upload to chat-attachments" ON storage.objects;
-- Then re-run the CREATE POLICY statements above.
-- this is batch 58 and it didnot executed successfully
-- error: Error: Failed to run sql query: ERROR: 42601: syntax error at or near "NOT" LINE 19: CREATE POLICY IF NOT EXISTS "Public read access for chat-attachments" ^




















-- 1. Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-attachments',
    'chat-attachments', 
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']::text[];

-- 2. Drop existing policies first
DROP POLICY IF EXISTS "Public read access for chat-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read chat-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to chat-attachments" ON storage.objects;

-- 3. Create read policy
CREATE POLICY "Anyone can read chat-attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments');

-- 4. Create upload policy
CREATE POLICY "Anyone can upload to chat-attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-attachments');
-- this is batch 58_v2 and it executed successfully





















-- Update storage bucket to allow more file types
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
    'image/jpeg', 
    'image/png', 
    'image/gif', 
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]::text[]
WHERE id = 'chat-attachments';
-- this is batch 59 and it executed successfully




















-- Allow ALL file types by setting to NULL (no restriction)
UPDATE storage.buckets 
SET allowed_mime_types = NULL
WHERE id = 'chat-attachments';
-- this is batch 60 and it executed successfully




















-- Create organization_subscriptions table
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  plan VARCHAR(20) NOT NULL DEFAULT 'trial',
  status VARCHAR(20) NOT NULL DEFAULT 'trialing',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  monthly_credits INTEGER NOT NULL DEFAULT 2000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;

-- this is batch 61 and it executed successfully




















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
-- this is batch 62 and it executed successfully




















-- testing queries, I mean, queries  used for testing 


-- Find organization ID by user email
SELECT o.id as org_id, o.name as org_name, u.email, om.role
FROM organizations o
JOIN organization_members om ON o.id = om.organization_id
JOIN auth.users u ON om.user_id = u.id
WHERE u.email = 'pshahidhasan@gmail.com'
ORDER BY o.created_at DESC;
-- this is batch 63 and it executed successfully











-- Insert test subscription using email lookup
INSERT INTO organization_subscriptions (
  organization_id,
  plan,
  status,
  stripe_customer_id,
  stripe_subscription_id,
  trial_ends_at,
  current_period_end,
  monthly_credits
) 
SELECT 
  om.organization_id,
  'starter',
  'trialing',
  'cus_test_123',
  'sub_test_123',
  NOW() + INTERVAL '7 days',
  NOW() + INTERVAL '7 days',
  2000
FROM organization_members om
JOIN auth.users u ON om.user_id = u.id
WHERE u.email = 'pshahidhasan@gmail.com'
LIMIT 1
ON CONFLICT (organization_id) DO UPDATE SET
  status = 'trialing',
  plan = 'starter',
  trial_ends_at = NOW() + INTERVAL '7 days';
-- this is batch 64 and it didnot executed successfully
--error : Error: Failed to run sql query: ERROR: 42703: column "plan" of relation "organization_subscriptions" does not exist LINE 4: plan, ^

















-- Check actual columns in organization_subscriptions
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'organization_subscriptions'
ORDER BY ordinal_position;
-- this is batch 65 and it didnot executed successfully

















INSERT INTO organization_subscriptions (
  organization_id,
  plan_code,
  status,
  stripe_customer_id,
  stripe_subscription_id,
  trial_end,
  current_period_end
) 
SELECT 
  om.organization_id,
  'starter',
  'trialing',
  'cus_test_123',
  'sub_test_123',
  NOW() + INTERVAL '7 days',
  NOW() + INTERVAL '7 days'
FROM organization_members om
JOIN auth.users u ON om.user_id = u.id
WHERE u.email = 'pshahidhasan@gmail.com'
LIMIT 1
ON CONFLICT (organization_id) DO UPDATE SET
  status = 'trialing',
  plan_code = 'starter',
  trial_end = NOW() + INTERVAL '7 days';
-- this is batch 66 and it executed successfully















INSERT INTO organization_credits (organization_id, balance_credits)
SELECT om.organization_id, 7500
FROM organization_members om
JOIN auth.users u ON om.user_id = u.id
WHERE u.email = 'pshahidhasan@gmail.com'
LIMIT 1
ON CONFLICT (organization_id) DO UPDATE SET
  balance_credits = 7500;
-- this is batch 67 and it executed successfully



















UPDATE organization_subscriptions
SET status = 'active', trial_end = NOW() - INTERVAL '1 day'
WHERE organization_id = (
  SELECT om.organization_id 
  FROM organization_members om
  JOIN auth.users u ON om.user_id = u.id
  WHERE u.email = 'pshahidhasan@gmail.com'
  LIMIT 1
);

-- this is batch 67 and it executed successfully

















-- From sql/SQL55_task_tags.sql
CREATE TABLE IF NOT EXISTS task_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id);

ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON task_tags
  FOR ALL USING (auth.role() = 'service_role');

-- this is batch 68 and it executed successfully



















-- Proactive Messages for Embed Chatbot
-- Allows agents to automatically show a message based on URL pattern and timing.

CREATE TABLE IF NOT EXISTS public.agent_proactive_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  url_pattern text NOT NULL, -- e.g., '/pricing*' or '*'
  message text NOT NULL,
  delay_seconds integer NOT NULL DEFAULT 5, -- Wait before showing
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_proactive_triggers ENABLE ROW LEVEL SECURITY;

-- RLS: Members of the org can manage triggers for their agents
DROP POLICY IF EXISTS "Members manage agent triggers" ON public.agent_proactive_triggers;
CREATE POLICY "Members manage agent triggers" ON public.agent_proactive_triggers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = agent_proactive_triggers.agent_id
      AND public.is_org_member(a.organization_id)
    )
  );
-- this is batch 69 and it executed successfully









ALTER TABLE agent_sessions ADD COLUMN is_escalated BOOLEAN DEFAULT false;
-- this is batch 70 and it executed successfully








-- Add status column to agent_sessions for tracking session lifecycle
-- Run this in Supabase SQL Editor

-- Add status column if not exists
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'open';

-- Also ensure is_escalated column exists
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN DEFAULT false;

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_escalated ON agent_sessions(is_escalated);

-- Comment: Status values: 'open', 'active', 'escalated', 'closed'
-- this is batch 71 and it executed successfully








ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'open';
-- this is batch 72 and it executed successfully




















-- Table for persisting user generations (blogs, images)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('blog', 'image')),
  title TEXT,
  content TEXT,
  image_url TEXT,
  prompt TEXT,
  model TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_generations_user_id ON user_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_generations_type ON user_generations(type);
CREATE INDEX IF NOT EXISTS idx_user_generations_created_at ON user_generations(created_at DESC);

-- RLS policies
ALTER TABLE user_generations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own generations
CREATE POLICY "Users can view own generations" ON user_generations
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own generations
CREATE POLICY "Users can insert own generations" ON user_generations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own generations
CREATE POLICY "Users can delete own generations" ON user_generations
  FOR DELETE USING (auth.uid() = user_id);

-- this is batch 73 and it executed successfully




















