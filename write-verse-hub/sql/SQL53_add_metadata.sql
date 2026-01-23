-- Add metadata column to agent_messages to support tool usage tracking
ALTER TABLE public.agent_messages ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
