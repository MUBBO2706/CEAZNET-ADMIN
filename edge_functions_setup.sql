-- Run this in your Supabase SQL Editor to track all Edge Functions

-- 1. Create log tables for the other functions (if they don't exist)
CREATE TABLE IF NOT EXISTS enrich_sources_logs (
    id BIGSERIAL PRIMARY KEY,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS image_proxy_logs (
    id BIGSERIAL PRIMARY KEY,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS update_article_stats_logs (
    id BIGSERIAL PRIMARY KEY,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Update the RPC to combine stats from all function log tables
CREATE OR REPLACE FUNCTION get_function_stats()
RETURNS TABLE(
  function_name text,
  total_calls bigint,
  success_count bigint,
  error_count bigint,
  last_run timestamptz
) AS $$
BEGIN
  RETURN QUERY
  
  -- update-news
  SELECT
    'update-news'::text as function_name,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') as success_count,
    COUNT(*) FILTER (WHERE status != 'SUCCESS') as error_count,
    MAX(created_at) as last_run
  FROM update_news_logs
  
  UNION ALL
  
  -- enrich-sources
  SELECT
    'enrich-sources'::text as function_name,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') as success_count,
    COUNT(*) FILTER (WHERE status != 'SUCCESS') as error_count,
    MAX(created_at) as last_run
  FROM enrich_sources_logs
  
  UNION ALL
  
  -- image-proxy
  SELECT
    'image-proxy'::text as function_name,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') as success_count,
    COUNT(*) FILTER (WHERE status != 'SUCCESS') as error_count,
    MAX(created_at) as last_run
  FROM image_proxy_logs
  
  UNION ALL
  
  -- update-article-stats
  SELECT
    'update-article-stats'::text as function_name,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') as success_count,
    COUNT(*) FILTER (WHERE status != 'SUCCESS') as error_count,
    MAX(created_at) as last_run
  FROM update_article_stats_logs;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_function_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_function_stats() TO service_role;
