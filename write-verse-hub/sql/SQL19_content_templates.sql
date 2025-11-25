-- Content Templates Table for Custom Tools
CREATE TABLE IF NOT EXISTS public.content_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text DEFAULT 'custom',
  icon text,
  schema jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of field definitions: { key, label, type, placeholder }
  prompt_text text NOT NULL, -- "Write a {key} for {other_key}..."
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_templates ENABLE ROW LEVEL SECURITY;

-- Policies
-- View: All members of the org
DROP POLICY IF EXISTS "Org members can view templates" ON public.content_templates;
CREATE POLICY "Org members can view templates" ON public.content_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = content_templates.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Manage: Editors, Admins, Owners
DROP POLICY IF EXISTS "Org editors can manage templates" ON public.content_templates;
CREATE POLICY "Org editors can manage templates" ON public.content_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = content_templates.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'editor')
    )
  );
