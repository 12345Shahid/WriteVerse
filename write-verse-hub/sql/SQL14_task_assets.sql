-- Link Assets to Tasks (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.task_assets (
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, asset_id)
);

ALTER TABLE public.task_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view task assets" ON public.task_assets;
CREATE POLICY "Members can view task assets" ON public.task_assets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON t.project_id = p.id
      WHERE t.id = task_assets.task_id
      AND public.is_org_member(p.organization_id)
    )
  );

DROP POLICY IF EXISTS "Members can manage task assets" ON public.task_assets;
CREATE POLICY "Members can manage task assets" ON public.task_assets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON t.project_id = p.id
      WHERE t.id = task_assets.task_id
      AND public.is_org_member(p.organization_id)
    )
  );
