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























