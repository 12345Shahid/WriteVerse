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
