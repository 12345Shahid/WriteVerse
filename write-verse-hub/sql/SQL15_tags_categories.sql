-- 1. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view categories" ON public.categories;
CREATE POLICY "Members can view categories" ON public.categories
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can manage categories" ON public.categories;
CREATE POLICY "Members can manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id));

-- 2. Tags Table
CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view tags" ON public.tags;
CREATE POLICY "Members can view tags" ON public.tags
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can manage tags" ON public.tags;
CREATE POLICY "Members can manage tags" ON public.tags
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id));

-- 3. Asset Tags (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.asset_tags (
  asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, tag_id)
);

ALTER TABLE public.asset_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view asset tags" ON public.asset_tags;
CREATE POLICY "Members can view asset tags" ON public.asset_tags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_tags.asset_id
      AND public.is_org_member(a.organization_id)
    )
  );

DROP POLICY IF EXISTS "Members can manage asset tags" ON public.asset_tags;
CREATE POLICY "Members can manage asset tags" ON public.asset_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_tags.asset_id
      AND public.is_org_member(a.organization_id)
    )
  );

-- 4. Update Assets/Folders columns
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_categories_org ON public.categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_tags_org ON public.tags(organization_id);
CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(category_id);
CREATE INDEX IF NOT EXISTS idx_folders_category ON public.folders(category_id);
