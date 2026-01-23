-- Composio Integration Tables for WriterAI
-- Run this migration to enable agent/tool integrations

-- ============================================
-- Table: agent_integrations
-- Stores which Composio apps are connected for each agent
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- Made nullable for org-level connections
  
  -- Composio connection info
  app_name VARCHAR(100) NOT NULL,  -- e.g., 'SLACK', 'GMAIL', 'NOTION'
  connection_id VARCHAR(255),       -- Composio's connection ID
  connection_status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'connected', 'error', 'revoked'
  
  -- Metadata
  connected_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique connection per agent/app
  UNIQUE(agent_id, app_name)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_agent_integrations_agent ON public.agent_integrations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_integrations_org ON public.agent_integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_integrations_status ON public.agent_integrations(connection_status);

-- ============================================
-- Table: tool_executions
-- Logs all tool/action executions for debugging and analytics
-- ============================================
CREATE TABLE IF NOT EXISTS public.tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Execution context
  source_type VARCHAR(50) NOT NULL,  -- 'agent', 'workflow', 'tool'
  source_id UUID,                     -- agent_id, workflow_id, or null for direct tool
  source_name VARCHAR(255),           -- Human-readable name
  
  -- Tool info
  tool_name VARCHAR(255) NOT NULL,    -- e.g., 'SLACK_SEND_MESSAGE'
  app_name VARCHAR(100),              -- e.g., 'SLACK'
  
  -- Execution details
  input_params JSONB,                 -- Parameters sent to tool
  output_result JSONB,                -- Result from tool
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- 'pending', 'success', 'error'
  error_message TEXT,
  error_code VARCHAR(100),
  
  -- Performance
  execution_time_ms INTEGER,
  
  -- Timestamps
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_tool_executions_org ON public.tool_executions(organization_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_source ON public.tool_executions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool ON public.tool_executions(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_executions_status ON public.tool_executions(status);
CREATE INDEX IF NOT EXISTS idx_tool_executions_date ON public.tool_executions(executed_at);

-- ============================================
-- Table: workflow_integrations  
-- Stores output destinations for workflow steps
-- ============================================
CREATE TABLE IF NOT EXISTS public.workflow_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Configuration
  step_id VARCHAR(100),               -- Which step triggers this (null = on completion)
  app_name VARCHAR(100) NOT NULL,     -- Target app
  action_name VARCHAR(255) NOT NULL,  -- Action to execute
  action_params JSONB,                -- Static params + variable mappings
  
  -- Status
  is_enabled BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_integrations_workflow ON public.workflow_integrations(workflow_id);

-- ============================================
-- Table: tool_output_destinations  
-- Stores output destinations for specialized tools
-- ============================================
CREATE TABLE IF NOT EXISTS public.tool_output_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Tool configuration
  tool_name VARCHAR(100) NOT NULL,     -- e.g., 'blog_post', 'email_writer'
  app_name VARCHAR(100) NOT NULL,      -- Target app e.g., 'NOTION'
  action_name VARCHAR(255) NOT NULL,   -- Action e.g., 'NOTION_CREATE_PAGE'
  action_params JSONB,                 -- Static params + variable mappings
  
  -- Status
  is_enabled BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_output_destinations_org ON public.tool_output_destinations(organization_id);
CREATE INDEX IF NOT EXISTS idx_tool_output_destinations_tool ON public.tool_output_destinations(tool_name);

-- ============================================
-- Enable RLS (Row Level Security)
-- ============================================
ALTER TABLE public.agent_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_integrations
CREATE POLICY "Users can view own org integrations" ON public.agent_integrations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own org integrations" ON public.agent_integrations
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for tool_executions
CREATE POLICY "Users can view own org executions" ON public.tool_executions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for workflow_integrations  
CREATE POLICY "Users can view own org workflow integrations" ON public.workflow_integrations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own org workflow integrations" ON public.workflow_integrations
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Helper function to log tool execution
-- ============================================
CREATE OR REPLACE FUNCTION public.log_tool_execution(
  p_organization_id UUID,
  p_user_id UUID,
  p_source_type VARCHAR(50),
  p_source_id UUID,
  p_source_name VARCHAR(255),
  p_tool_name VARCHAR(255),
  p_app_name VARCHAR(100),
  p_input_params JSONB,
  p_output_result JSONB,
  p_status VARCHAR(50),
  p_error_message TEXT DEFAULT NULL,
  p_error_code VARCHAR(100) DEFAULT NULL,
  p_execution_time_ms INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.tool_executions (
    organization_id, user_id, source_type, source_id, source_name,
    tool_name, app_name, input_params, output_result, status,
    error_message, error_code, execution_time_ms
  ) VALUES (
    p_organization_id, p_user_id, p_source_type, p_source_id, p_source_name,
    p_tool_name, p_app_name, p_input_params, p_output_result, p_status,
    p_error_message, p_error_code, p_execution_time_ms
  ) RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.log_tool_execution TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_tool_execution TO service_role;
