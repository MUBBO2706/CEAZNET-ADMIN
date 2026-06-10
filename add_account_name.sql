-- Add account_name column to news_api_keys table
ALTER TABLE public.news_api_keys ADD COLUMN IF NOT EXISTS account_name TEXT;
