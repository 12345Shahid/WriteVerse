-- Fixes for Lead Capture and Message Persistence

-- 1. Support for Lead Capture in Widget
ALTER TABLE public.agent_sessions 
ADD COLUMN IF NOT EXISTS customer_email text,
ADD COLUMN IF NOT EXISTS customer_name text,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 2. Support for Human Replies (tracking who replied)
ALTER TABLE public.agent_messages 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Index for faster lookup of customer sessions
CREATE INDEX IF NOT EXISTS idx_agent_sessions_email ON public.agent_sessions(customer_email);
