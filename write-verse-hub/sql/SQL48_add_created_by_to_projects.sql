-- SQL48_add_created_by_to_projects.sql
-- Add created_by column to projects table if it doesn't exist

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'projects'
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.projects
        ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;
