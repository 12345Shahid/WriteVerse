-- Workflow System Schema

-- 1. Workflows Table (Templates)
CREATE TABLE IF NOT EXISTS public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb, 
  -- Structure: [{ "id": "step1", "tool": "blog_post", "params": {...}, "input_map": {"topic": "{{step0.title}}"} }]
  is_public boolean DEFAULT false, -- If true, visible to all org members
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Workflow Executions Table (Run History)
CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES public.workflows(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id),
  status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  current_step_index integer DEFAULT 0,
  results jsonb DEFAULT '{}'::jsonb, -- Map of step_id -> output data
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- 3. RLS Policies
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

-- Workflows: Members can view, Admins can edit
CREATE POLICY "Members can view workflows" ON public.workflows
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "Admins can manage workflows" ON public.workflows
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id));

-- Executions: Members can view/create their own or org's executions
CREATE POLICY "Members can view org executions" ON public.workflow_executions
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can create executions" ON public.workflow_executions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update own executions" ON public.workflow_executions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- 4. Indexes
CREATE INDEX idx_workflows_org ON public.workflows(organization_id);
CREATE INDEX idx_executions_workflow ON public.workflow_executions(workflow_id);
CREATE INDEX idx_executions_user ON public.workflow_executions(user_id);
