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
