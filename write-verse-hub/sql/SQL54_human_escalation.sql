-- Support for Human Escalation Workflow
-- Adds status column to track if a session is active (AI replying), escalated (Human replying), or closed.

ALTER TABLE public.agent_sessions 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'escalated', 'closed'));

-- Index for faster inbox queries
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON public.agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_updated_at ON public.agent_sessions(updated_at DESC);

-- Allow support team (org members) to view all sessions for their org
-- (Existing policies might restrict to own sessions, need to broaden for support)

-- Update policy for Members to see ALL sessions in their org (for Inbox)
-- First check existing policies on agent_sessions
DROP POLICY IF EXISTS "Users manage own sessions" ON public.agent_sessions;

-- New Policy: Users can see their own sessions, OR org members can see sessions for agents in their org
CREATE POLICY "Users and Support view sessions" ON public.agent_sessions
FOR ALL TO authenticated
USING (
    user_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM public.agents a
        WHERE a.id = agent_sessions.agent_id 
        AND public.is_org_member(a.organization_id)
    )
);

-- Need similar policy for messages to allow Support to read/reply
DROP POLICY IF EXISTS "Users manage own messages" ON public.agent_messages;

CREATE POLICY "Users and Support view messages" ON public.agent_messages
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.agent_sessions s
        JOIN public.agents a ON a.id = s.agent_id
        WHERE s.id = agent_messages.session_id
        AND (
            s.user_id = auth.uid() OR -- The user who started the chat
            public.is_org_member(a.organization_id) -- Support team
        )
    )
);
