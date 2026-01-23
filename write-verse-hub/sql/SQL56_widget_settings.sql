-- Add widget_settings column to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS widget_settings JSONB DEFAULT '{}'::jsonb;

-- Create storage bucket for chat attachments if it doesn't exist
-- Note: Bucket creation usually requires Supabase UI or generic API, but we can try inserting into storage.buckets if permissions allow.
-- For safety, we will assume the user or a separate process sets up the 'chat-attachments' bucket, 
-- or we handle it via the JS client if using the service role.
