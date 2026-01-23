-- Add status column to agent_sessions for tracking session lifecycle
-- Run this in Supabase SQL Editor

-- Add status column if not exists
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'open';

-- Also ensure is_escalated column exists
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN DEFAULT false;

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_escalated ON agent_sessions(is_escalated);

-- Comment: Status values: 'open', 'active', 'escalated', 'closed'
