-- 1. Create a table for file metadata (to group chunks)
CREATE TABLE IF NOT EXISTS public.knowledge_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Link chunks to files
ALTER TABLE public.knowledge_docs ADD COLUMN IF NOT EXISTS file_id uuid REFERENCES public.knowledge_files(id) ON DELETE CASCADE;

-- 3. Link Agents to Files (Many-to-Many via array)
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS knowledge_file_ids uuid[] DEFAULT '{}';

-- 4. RLS for new table
ALTER TABLE public.knowledge_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view files" ON public.knowledge_files FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "Admins can manage files" ON public.knowledge_files FOR ALL TO authenticated USING (public.is_org_admin(organization_id));

-- 5. Update search function to filter by file_ids
CREATE OR REPLACE FUNCTION match_documents_with_filters (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_org_id uuid,
  filter_file_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float,
  file_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_docs.id,
    knowledge_docs.content,
    1 - (knowledge_docs.embedding <=> query_embedding) AS similarity,
    knowledge_docs.file_id
  FROM knowledge_docs
  WHERE 1 - (knowledge_docs.embedding <=> query_embedding) > match_threshold
  AND knowledge_docs.organization_id = filter_org_id
  AND (filter_file_ids IS NULL OR knowledge_docs.file_id = ANY(filter_file_ids))
  ORDER BY knowledge_docs.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
