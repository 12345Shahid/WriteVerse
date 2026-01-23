-- SQL50_add_color_to_tags.sql
-- Add color column to tags table if it doesn't exist

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tags'
        AND column_name = 'color'
    ) THEN
        ALTER TABLE public.tags
        ADD COLUMN color text DEFAULT '#94a3b8';
    END IF;
END $$;
