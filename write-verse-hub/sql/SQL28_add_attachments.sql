-- Add attachments column to agent_messages to support file uploads (images/PDFs) in chat
ALTER TABLE public.agent_messages ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
