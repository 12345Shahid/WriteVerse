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
