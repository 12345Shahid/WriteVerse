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
