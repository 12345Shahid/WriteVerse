-- SQL49_add_type_to_tags.sql
-- Add type column to tags table if it doesn't exist

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tags'
        AND column_name = 'type'
    ) THEN
        ALTER TABLE public.tags
        ADD COLUMN type text NOT NULL DEFAULT 'project';
    END IF;
END $$;
