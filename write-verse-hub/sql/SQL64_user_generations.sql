-- Table for persisting user generations (blogs, images)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('blog', 'image')),
  title TEXT,
  content TEXT,
  image_url TEXT,
  prompt TEXT,
  model TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_generations_user_id ON user_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_generations_type ON user_generations(type);
CREATE INDEX IF NOT EXISTS idx_user_generations_created_at ON user_generations(created_at DESC);

-- RLS policies
ALTER TABLE user_generations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own generations
CREATE POLICY "Users can view own generations" ON user_generations
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own generations
CREATE POLICY "Users can insert own generations" ON user_generations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own generations
CREATE POLICY "Users can delete own generations" ON user_generations
  FOR DELETE USING (auth.uid() = user_id);
