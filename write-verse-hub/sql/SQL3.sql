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
