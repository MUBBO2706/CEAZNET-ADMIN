-- Enable Real-time for News Settings Tables
-- The components NewsSettings and NewsContentManager listen to these tables
-- Run this in your Supabase SQL Editor if you are experiencing issues with realtime updates

BEGIN;

-- Add News Config table to realtime
DO $$
BEGIN
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'news_system_config'
    ) then
        ALTER PUBLICATION supabase_realtime ADD TABLE public.news_system_config;
    end if;
END $$;

-- Add News API Keys table to realtime
DO $$
BEGIN
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'news_api_keys'
    ) then
        ALTER PUBLICATION supabase_realtime ADD TABLE public.news_api_keys;
    end if;
END $$;

-- Add News Articles table to realtime (if needed in the future for live updates)
DO $$
BEGIN
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'news_articles'
    ) then
        ALTER PUBLICATION supabase_realtime ADD TABLE public.news_articles;
    end if;
END $$;

COMMIT;
