-- Prevent duplicate agent names within an organization
ALTER TABLE public.agents ADD CONSTRAINT agents_org_name_key UNIQUE (organization_id, name);

-- Prevent duplicate knowledge file titles within an organization
ALTER TABLE public.knowledge_files ADD CONSTRAINT knowledge_files_org_title_key UNIQUE (organization_id, title);
