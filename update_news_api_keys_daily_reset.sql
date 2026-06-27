-- 1. Update the provider check constraint to include brevo
ALTER TABLE public.news_api_keys DROP CONSTRAINT IF EXISTS news_api_keys_provider_check;
ALTER TABLE public.news_api_keys ADD CONSTRAINT news_api_keys_provider_check CHECK (provider IN ('gnews', 'gemini', 'brevo'));

-- 2. Add new columns to news_api_keys
ALTER TABLE public.news_api_keys 
ADD COLUMN IF NOT EXISTS daily_call_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- 3. Create the daily usage tracking table
CREATE TABLE IF NOT EXISTS public.api_key_daily_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    api_key_id UUID NOT NULL REFERENCES public.news_api_keys(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    usage_date DATE NOT NULL,
    call_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(api_key_id, usage_date)
);

-- Enable RLS for the new table
ALTER TABLE public.api_key_daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users on daily usage" 
ON public.api_key_daily_usage FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role on daily usage" 
ON public.api_key_daily_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Create helper functions for provider timezones
CREATE OR REPLACE FUNCTION public.get_provider_current_date(p_provider TEXT) 
RETURNS DATE AS $$
BEGIN
    IF p_provider = 'gemini' THEN
        RETURN (now() AT TIME ZONE 'America/Los_Angeles')::DATE;
    ELSIF p_provider = 'brevo' THEN
        RETURN (now() AT TIME ZONE 'UTC')::DATE;
    ELSE
        RETURN (now() AT TIME ZONE 'UTC')::DATE;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.needs_daily_reset(p_provider TEXT, p_last_reset_at TIMESTAMPTZ) 
RETURNS BOOLEAN AS $$
DECLARE
    v_last_date DATE;
    v_curr_date DATE;
BEGIN
    IF p_provider = 'gemini' THEN
        v_last_date := (p_last_reset_at AT TIME ZONE 'America/Los_Angeles')::DATE;
        v_curr_date := (now() AT TIME ZONE 'America/Los_Angeles')::DATE;
    ELSIF p_provider = 'brevo' THEN
        v_last_date := (p_last_reset_at AT TIME ZONE 'UTC')::DATE;
        v_curr_date := (now() AT TIME ZONE 'UTC')::DATE;
    ELSE
        v_last_date := (p_last_reset_at AT TIME ZONE 'UTC')::DATE;
        v_curr_date := (now() AT TIME ZONE 'UTC')::DATE;
    END IF;
    
    RETURN v_curr_date > v_last_date;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Create function to perform lazy reset
CREATE OR REPLACE FUNCTION public.perform_lazy_daily_reset(p_provider TEXT)
RETURNS VOID AS $$
BEGIN
    -- Update all keys for this provider that need a reset
    UPDATE public.news_api_keys
    SET 
        daily_call_count = 0,
        failure_count = 0,
        status = 'active',
        last_reset_at = now(),
        updated_at = now()
    WHERE provider = p_provider 
      AND public.needs_daily_reset(provider, last_reset_at) = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Update get_active_news_api_key
CREATE OR REPLACE FUNCTION public.get_active_news_api_key(p_provider TEXT)
RETURNS TEXT AS $$
DECLARE
    v_api_key TEXT;
    v_id UUID;
    v_curr_date DATE;
BEGIN
    -- 1. Perform lazy reset for the provider
    PERFORM public.perform_lazy_daily_reset(p_provider);

    -- 2. Find an active key with the lowest daily call count
    SELECT id, api_key INTO v_id, v_api_key
    FROM public.news_api_keys
    WHERE provider = p_provider AND status = 'active'
    ORDER BY daily_call_count ASC, updated_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_id IS NOT NULL THEN
        -- 3. Increment call counts
        UPDATE public.news_api_keys
        SET call_count = call_count + 1,
            daily_call_count = daily_call_count + 1,
            updated_at = now()
        WHERE id = v_id;
        
        -- 4. Upsert daily usage
        v_curr_date := public.get_provider_current_date(p_provider);
        
        INSERT INTO public.api_key_daily_usage (api_key_id, provider, usage_date, call_count)
        VALUES (v_id, p_provider, v_curr_date, 1)
        ON CONFLICT (api_key_id, usage_date) 
        DO UPDATE SET 
            call_count = public.api_key_daily_usage.call_count + 1,
            provider = EXCLUDED.provider; -- just to touch the row
            
        RETURN v_api_key;
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Update report_news_api_key_failure
CREATE OR REPLACE FUNCTION public.report_news_api_key_failure(p_api_key TEXT, p_max_failures INTEGER DEFAULT 3)
RETURNS VOID AS $$
DECLARE
    v_id UUID;
    v_provider TEXT;
    v_curr_date DATE;
BEGIN
    -- Get the key details
    SELECT id, provider INTO v_id, v_provider
    FROM public.news_api_keys
    WHERE api_key = p_api_key;

    IF v_id IS NOT NULL THEN
        -- Update the main table
        UPDATE public.news_api_keys
        SET failure_count = failure_count + 1,
            status = CASE 
                WHEN failure_count + 1 >= p_max_failures THEN 'exhausted'
                ELSE status
            END,
            updated_at = now()
        WHERE id = v_id;

        -- Upsert daily usage failure
        v_curr_date := public.get_provider_current_date(v_provider);
        
        INSERT INTO public.api_key_daily_usage (api_key_id, provider, usage_date, failure_count)
        VALUES (v_id, v_provider, v_curr_date, 1)
        ON CONFLICT (api_key_id, usage_date) 
        DO UPDATE SET 
            failure_count = public.api_key_daily_usage.failure_count + 1;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
