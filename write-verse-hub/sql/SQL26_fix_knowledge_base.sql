-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge Base Documents Table
CREATE TABLE IF NOT EXISTS public.knowledge_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL, -- The actual text chunk
  metadata jsonb DEFAULT '{}'::jsonb, -- Source filename, page number, etc.
  embedding vector(768), -- Gemini embeddings are 768 dimensions
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.knowledge_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view org docs" ON public.knowledge_docs;
CREATE POLICY "Members can view org docs" ON public.knowledge_docs
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Admins can manage org docs" ON public.knowledge_docs;
CREATE POLICY "Admins can manage org docs" ON public.knowledge_docs
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id));

-- Vector Search Function
-- Matches documents by cosine similarity
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_org_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_docs.id,
    knowledge_docs.content,
    1 - (knowledge_docs.embedding <=> query_embedding) AS similarity
  FROM knowledge_docs
  WHERE 1 - (knowledge_docs.embedding <=> query_embedding) > match_threshold
  AND knowledge_docs.organization_id = filter_org_id
  ORDER BY knowledge_docs.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
