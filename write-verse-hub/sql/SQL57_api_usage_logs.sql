-- API Usage Logs
-- Tracks API calls for billing and analytics

CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.organization_api_keys(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  tool_name text,
  status text NOT NULL DEFAULT 'success', -- success, error
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying usage
CREATE INDEX IF NOT EXISTS idx_api_usage_org_date ON public.api_usage_logs(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_key ON public.api_usage_logs(api_key_id, created_at);

ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS: Org members can view their usage
DROP POLICY IF EXISTS "Members view api usage" ON public.api_usage_logs;
CREATE POLICY "Members view api usage" ON public.api_usage_logs
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

-- this is batch 70 and it should be executed in Supabase SQL Editor
