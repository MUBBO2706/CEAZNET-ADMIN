-- Execute this query to add the expires_at column to your broadcasts table
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
