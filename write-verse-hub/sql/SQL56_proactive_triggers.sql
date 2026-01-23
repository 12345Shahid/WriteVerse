-- Proactive Messages for Embed Chatbot
-- Allows agents to automatically show a message based on URL pattern and timing.

CREATE TABLE IF NOT EXISTS public.agent_proactive_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  url_pattern text NOT NULL, -- e.g., '/pricing*' or '*'
  message text NOT NULL,
  delay_seconds integer NOT NULL DEFAULT 5, -- Wait before showing
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_proactive_triggers ENABLE ROW LEVEL SECURITY;

-- RLS: Members of the org can manage triggers for their agents
DROP POLICY IF EXISTS "Members manage agent triggers" ON public.agent_proactive_triggers;
CREATE POLICY "Members manage agent triggers" ON public.agent_proactive_triggers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = agent_proactive_triggers.agent_id
      AND public.is_org_member(a.organization_id)
    )
  );
