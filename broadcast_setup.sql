-- broadcast_setup.sql

-- 1. Create table for Broadcasts
CREATE TABLE IF NOT EXISTS public.broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    raw_html TEXT,
    status TEXT DEFAULT 'draft', -- 'draft', 'sent'
    type VARCHAR(50) DEFAULT 'popup', -- 'popup', 'system_banner'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    sent_at TIMESTAMP WITH TIME ZONE
);

-- Safely add 'type' column if updating an existing table
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'popup';

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
-- Simple policy for admin panel (assuming all authenticated can access)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'broadcasts' AND policyname = 'Enable all for authenticated users'
    ) THEN
        CREATE POLICY "Enable all for authenticated users" ON public.broadcasts FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- 2. Create table for AI iterations context
CREATE TABLE IF NOT EXISTS public.broadcast_iterations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id UUID REFERENCES public.broadcasts(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user' or 'model'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.broadcast_iterations ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'broadcast_iterations' AND policyname = 'Enable all for authenticated users'
    ) THEN
        CREATE POLICY "Enable all for authenticated users" ON public.broadcast_iterations FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Enable realtime for broadcasts table
-- (Note: The actual message push will use Supabase Broadcast Channel, but having realtime enabled for the table is good practice)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'broadcasts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;
    END IF;
END $$;
