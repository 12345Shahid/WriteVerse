-- Team Chat Tables

-- Threads
CREATE TABLE IF NOT EXISTS public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  topic text NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL, -- Null for AI
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_threads_org ON public.chat_threads(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON public.chat_messages(thread_id);

-- RLS
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies for Threads
DROP POLICY IF EXISTS "Org members can view threads" ON public.chat_threads;
CREATE POLICY "Org members can view threads" ON public.chat_threads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = chat_threads.organization_id
      AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can create threads" ON public.chat_threads;
CREATE POLICY "Org members can create threads" ON public.chat_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = chat_threads.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Policies for Messages
DROP POLICY IF EXISTS "Org members can view messages" ON public.chat_messages;
CREATE POLICY "Org members can view messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_threads t
      JOIN public.organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = chat_messages.thread_id
      AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can insert messages" ON public.chat_messages;
CREATE POLICY "Org members can insert messages" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_threads t
      JOIN public.organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = chat_messages.thread_id
      AND om.user_id = auth.uid()
    )
  );

-- Enable Realtime
DO $$
BEGIN
  -- Check if publication exists, if not create it (standard in Supabase)
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- Add tables to publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_threads;
