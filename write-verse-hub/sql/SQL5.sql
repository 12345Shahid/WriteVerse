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
