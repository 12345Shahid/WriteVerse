-- Agents Table
CREATE TABLE IF NOT EXISTS public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  instructions text NOT NULL, -- The custom system prompt
  model_config jsonb DEFAULT '{"model": "gemini-1.5-flash", "temperature": 0.7}'::jsonb,
  is_public boolean DEFAULT false, -- If true, visible to all org members
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Agent Chat Sessions (History)
CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Agent Messages
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

-- Agents: Members can view, Admins/Creators can edit
DROP POLICY IF EXISTS "Members can view agents" ON public.agents;
CREATE POLICY "Members can view agents" ON public.agents
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can create agents" ON public.agents;
CREATE POLICY "Members can create agents" ON public.agents
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Creators/Admins can update agents" ON public.agents;
CREATE POLICY "Creators/Admins can update agents" ON public.agents
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_org_admin(organization_id));

-- Sessions: Users can view/manage their own sessions
DROP POLICY IF EXISTS "Users manage own sessions" ON public.agent_sessions;
CREATE POLICY "Users manage own sessions" ON public.agent_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- Messages: Users manage messages in their sessions
DROP POLICY IF EXISTS "Users manage own messages" ON public.agent_messages;
CREATE POLICY "Users manage own messages" ON public.agent_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agent_sessions 
      WHERE id = agent_messages.session_id AND user_id = auth.uid()
    )
  );
