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
