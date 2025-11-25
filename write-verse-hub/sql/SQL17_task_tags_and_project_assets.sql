-- 1. Task Tags (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.task_tags (
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view task tags" ON public.task_tags;
CREATE POLICY "Members can view task tags" ON public.task_tags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON t.project_id = p.id
      WHERE t.id = task_tags.task_id
      AND public.is_org_member(p.organization_id)
    )
  );

DROP POLICY IF EXISTS "Members can manage task tags" ON public.task_tags;
CREATE POLICY "Members can manage task tags" ON public.task_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON t.project_id = p.id
      WHERE t.id = task_tags.task_id
      AND public.is_org_member(p.organization_id)
    )
  );

-- 2. Project Assets (Many-to-Many) - For attaching files to the project itself
CREATE TABLE IF NOT EXISTS public.project_assets (
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE,
  added_at timestamptz DEFAULT now(),
  PRIMARY KEY (project_id, asset_id)
);

ALTER TABLE public.project_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view project assets" ON public.project_assets;
CREATE POLICY "Members can view project assets" ON public.project_assets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_assets.project_id
      AND public.is_org_member(p.organization_id)
    )
  );

DROP POLICY IF EXISTS "Members can manage project assets" ON public.project_assets;
CREATE POLICY "Members can manage project assets" ON public.project_assets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_assets.project_id
      AND public.is_org_member(p.organization_id)
    )
  );
