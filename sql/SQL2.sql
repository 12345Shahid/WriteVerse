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
