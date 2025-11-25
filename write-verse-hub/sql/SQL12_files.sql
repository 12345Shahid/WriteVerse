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
