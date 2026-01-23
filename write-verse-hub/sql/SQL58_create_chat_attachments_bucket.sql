-- SQL58_v2: Create chat-attachments storage bucket for widget file uploads
-- Run this in Supabase SQL Editor

-- 1. Create the storage bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-attachments',
    'chat-attachments', 
    true,  -- Make it public
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']::text[];

-- 2. Drop existing policies if they exist (ignore errors)
DROP POLICY IF EXISTS "Public read access for chat-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload to chat-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read chat-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to chat-attachments" ON storage.objects;

-- 3. Create policy for public read access
CREATE POLICY "Anyone can read chat-attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-attachments');

-- 4. Create policy for uploads (allow all for now - the API validates)
CREATE POLICY "Anyone can upload to chat-attachments"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'chat-attachments');
