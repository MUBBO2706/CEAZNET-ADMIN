CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value JSONB,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (so the client app can read the logo/email)
CREATE POLICY "Allow public read access on platform_settings" ON public.platform_settings
    FOR SELECT TO public USING (true);

-- Allow authenticated admins to full access
CREATE POLICY "Allow authenticated admins full access on platform_settings" ON public.platform_settings
    FOR ALL TO authenticated USING (auth.role() = 'authenticated');

-- Insert defaults
INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES 
    ('support_email', '"Support@ceaznet.com"', 'The email address displayed in the support inbox and client app'),
    ('platform_logo_url', '"/logo.png"', 'The URL of the brand logo displayed in header and inbox'),
    ('platform_favicon_url', '"/logo.png"', 'The URL of the favicon for the application'),
    ('activity_logs_max_limit', '1000', 'The maximum number of activity logs to retain')
ON CONFLICT (setting_key) DO NOTHING;

-- ==============================================================================
-- Clean up old activity logs dynamically according to platform settings
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.clean_old_activity_logs()
RETURNS TRIGGER AS $$
DECLARE
    v_max_limit INT;
BEGIN
    -- Fetch limit from platform_settings, fallback to 1000 if not set or invalid
    SELECT COALESCE(
        NULLIF(TRIM(BOTH '"' FROM setting_value::text), 'null')::INT,
        1000
    ) INTO v_max_limit
    FROM public.platform_settings
    WHERE setting_key = 'activity_logs_max_limit';

    -- Delete old records exceeding the dynamic limit
    DELETE FROM public.activity_logs
    WHERE id NOT IN (
        SELECT id FROM public.activity_logs
        ORDER BY created_at DESC
        LIMIT v_max_limit
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on activity_logs AFTER INSERT
DROP TRIGGER IF EXISTS trg_clean_old_activity_logs ON public.activity_logs;
CREATE TRIGGER trg_clean_old_activity_logs
    AFTER INSERT ON public.activity_logs
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.clean_old_activity_logs();

