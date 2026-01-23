-- Task Tags: Many-to-many relationship between tasks and tags
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS task_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, tag_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id);

-- Enable RLS
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY "service_role_full_access" ON task_tags
  FOR ALL USING (auth.role() = 'service_role');

-- Optional: Allow authenticated users to manage task tags if they're org members
-- This is handled by the API layer with service role, so this is optional
