-- 1. Project Tags (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.project_tags (
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, tag_id)
);

ALTER TABLE public.project_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view project tags" ON public.project_tags;
CREATE POLICY "Members can view project tags" ON public.project_tags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_tags.project_id
      AND public.is_org_member(p.organization_id)
    )
  );

DROP POLICY IF EXISTS "Members can manage project tags" ON public.project_tags;
CREATE POLICY "Members can manage project tags" ON public.project_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_tags.project_id
      AND public.is_org_member(p.organization_id)
    )
  );

-- 2. Folder Tags (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.folder_tags (
  folder_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (folder_id, tag_id)
);

ALTER TABLE public.folder_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view folder tags" ON public.folder_tags;
CREATE POLICY "Members can view folder tags" ON public.folder_tags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.folders f
      WHERE f.id = folder_tags.folder_id
      AND public.is_org_member(f.organization_id)
    )
  );

DROP POLICY IF EXISTS "Members can manage folder tags" ON public.folder_tags;
CREATE POLICY "Members can manage folder tags" ON public.folder_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.folders f
      WHERE f.id = folder_tags.folder_id
      AND public.is_org_member(f.organization_id)
    )
  );
