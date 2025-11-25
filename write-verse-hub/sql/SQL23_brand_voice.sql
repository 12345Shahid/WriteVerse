-- Brand Voice System Tables

CREATE TABLE IF NOT EXISTS public.brand_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  tone_tags text[], -- e.g. ['Friendly', 'Professional']
  rules jsonb DEFAULT '{"dos": [], "donts": []}'::jsonb, -- Structured rules
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_voice_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_id uuid NOT NULL REFERENCES public.brand_voices(id) ON DELETE CASCADE,
  content text NOT NULL, -- The actual sample text
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brand_voices_org ON public.brand_voices(organization_id);
CREATE INDEX IF NOT EXISTS idx_brand_voice_samples_voice ON public.brand_voice_samples(voice_id);

-- RLS
ALTER TABLE public.brand_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_voice_samples ENABLE ROW LEVEL SECURITY;

-- Policies for Brand Voices

-- View: All Org Members
DROP POLICY IF EXISTS "Org members can view brand voices" ON public.brand_voices;
CREATE POLICY "Org members can view brand voices" ON public.brand_voices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = brand_voices.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Manage: Only Admins (and maybe creator? Let's stick to Admin based on previous RBAC consolidation)
-- Actually, Users with 'role=admin' in organization_members.
DROP POLICY IF EXISTS "Admins can manage brand voices" ON public.brand_voices;
CREATE POLICY "Admins can manage brand voices" ON public.brand_voices
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = brand_voices.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );

-- Policies for Samples (Inherit access from Voice)
DROP POLICY IF EXISTS "Org members can view samples" ON public.brand_voice_samples;
CREATE POLICY "Org members can view samples" ON public.brand_voice_samples
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_voices v
      JOIN public.organization_members om ON om.organization_id = v.organization_id
      WHERE v.id = brand_voice_samples.voice_id
      AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage samples" ON public.brand_voice_samples;
CREATE POLICY "Admins can manage samples" ON public.brand_voice_samples
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_voices v
      JOIN public.organization_members om ON om.organization_id = v.organization_id
      WHERE v.id = brand_voice_samples.voice_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;
ALTER PUBLICATION supabase_realtime ADD TABLE public.brand_voices;
