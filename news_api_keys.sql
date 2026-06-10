-- This script creates the new 'news_api_keys' table and its associated RPCs.
-- It also includes a temporary fix to bypass the 'attach_trigger_to_new_table' error.

-- 1. Temporarily disable the event trigger that is causing the error.
-- Note: Replace 'on_table_create' with the actual name of your event trigger if it differs.
-- You can find the name by running: SELECT evtname FROM pg_event_trigger;
DO $$
DECLARE
    trigger_name text;
BEGIN
    SELECT evtname INTO trigger_name FROM pg_event_trigger WHERE evtfoid = 'attach_trigger_to_new_table'::regproc;
    IF trigger_name IS NOT NULL THEN
        EXECUTE 'ALTER EVENT TRIGGER ' || quote_ident(trigger_name) || ' DISABLE';
    END IF;
END $$;

-- 2. Create the news_api_keys table
CREATE TABLE IF NOT EXISTS public.news_api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider IN ('gnews', 'gemini')),
    api_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted')),
    call_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS and create policies
ALTER TABLE public.news_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users" 
ON public.news_api_keys FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role" 
ON public.news_api_keys FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_news_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_news_api_keys_updated_at ON public.news_api_keys;
CREATE TRIGGER update_news_api_keys_updated_at
    BEFORE UPDATE ON public.news_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION public.update_news_api_keys_updated_at();

-- 5. Create RPC for getting an active key and incrementing call count
CREATE OR REPLACE FUNCTION public.get_active_news_api_key(p_provider TEXT)
RETURNS TEXT AS $$
DECLARE
    v_api_key TEXT;
    v_id UUID;
BEGIN
    -- Find an active key with the lowest call count
    SELECT id, api_key INTO v_id, v_api_key
    FROM public.news_api_keys
    WHERE provider = p_provider AND status = 'active'
    ORDER BY call_count ASC, updated_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_id IS NOT NULL THEN
        -- Increment call count
        UPDATE public.news_api_keys
        SET call_count = call_count + 1,
            updated_at = now()
        WHERE id = v_id;
        
        RETURN v_api_key;
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create RPC for reporting a failure
CREATE OR REPLACE FUNCTION public.report_news_api_key_failure(p_api_key TEXT, p_max_failures INTEGER DEFAULT 3)
RETURNS VOID AS $$
BEGIN
    UPDATE public.news_api_keys
    SET failure_count = failure_count + 1,
        status = CASE 
            WHEN failure_count + 1 >= p_max_failures THEN 'exhausted'
            ELSE status
        END,
        updated_at = now()
    WHERE api_key = p_api_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Re-enable the event trigger
DO $$
DECLARE
    trigger_name text;
BEGIN
    SELECT evtname INTO trigger_name FROM pg_event_trigger WHERE evtfoid = 'attach_trigger_to_new_table'::regproc;
    IF trigger_name IS NOT NULL THEN
        EXECUTE 'ALTER EVENT TRIGGER ' || quote_ident(trigger_name) || ' ENABLE';
    END IF;
END $$;
