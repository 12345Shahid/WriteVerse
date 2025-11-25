
-- Project Tags (Many-to-Many)
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
