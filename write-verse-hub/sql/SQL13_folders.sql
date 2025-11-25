-- 1. Folders Table
CREATE TABLE IF NOT EXISTS public.folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Update Assets Table
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL;

-- 3. RLS for Folders
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view folders" ON public.folders;
CREATE POLICY "Members can view folders" ON public.folders
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can manage folders" ON public.folders;
CREATE POLICY "Members can manage folders" ON public.folders
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id));

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_folders_org ON public.folders(organization_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON public.folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_assets_folder ON public.assets(folder_id);
