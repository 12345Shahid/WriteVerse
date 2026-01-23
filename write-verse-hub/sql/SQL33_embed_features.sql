-- Support for Lead Capture and Metadata in Embed Chat
ALTER TABLE public.agent_sessions 
ADD COLUMN IF NOT EXISTS customer_email text,
ADD COLUMN IF NOT EXISTS customer_name text,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Index for looking up leads
CREATE INDEX IF NOT EXISTS idx_agent_sessions_email ON public.agent_sessions(customer_email);
