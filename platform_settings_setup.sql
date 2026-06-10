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
    ('platform_favicon_url', '"/logo.png"', 'The URL of the favicon for the application')
ON CONFLICT (setting_key) DO NOTHING;
