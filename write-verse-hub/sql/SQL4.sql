-- SQL4.sql: Add credits columns and set initial values
-- Run this in Supabase SQL editor after SQL1..SQL3

-- Add credits columns to users profile
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS credits_balance integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS credits_lifetime integer NOT NULL DEFAULT 500;

-- Backfill existing rows to a sane default for development/testing
UPDATE public.users
SET credits_balance = 500
WHERE credits_balance IS NULL OR credits_balance = 0;

UPDATE public.users
SET credits_lifetime = GREATEST(COALESCE(credits_lifetime, 0), credits_balance)
WHERE credits_lifetime IS NULL OR credits_lifetime = 0;

-- Ensure the onboarding trigger gives starter credits to new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, credits_balance, credits_lifetime)
  VALUES (NEW.id, NEW.email, 500, 500)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
