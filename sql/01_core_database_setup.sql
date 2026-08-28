-- ==============================================================================
-- 1. Create the activity_logs table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    operation TEXT,
    old_data JSONB,
    new_data JSONB,
    changed_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist even if the table was created with an older schema
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS table_name TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS operation TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS action_type TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS old_data JSONB;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS new_data JSONB;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS changed_by UUID;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Index for fast sorting and cleanup
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);

-- ==============================================================================
-- 2. Create the robust trigger function for all tables with dynamic limit
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.log_activity_function()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_source TEXT;
    v_role TEXT;
    v_max_limit INT := 1000;
    v_setting_text TEXT;
BEGIN
    -- Try to get the user ID and role from the JWT claims (Supabase auth)
    BEGIN
        v_user_id := (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::UUID;
        v_role := (current_setting('request.jwt.claims', true)::jsonb ->> 'role');
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
        v_role := NULL;
    END;

    -- Determine source automatically
    BEGIN
        v_source := current_setting('app.source', true);
    EXCEPTION WHEN OTHERS THEN
        v_source := NULL;
    END;

    IF v_source IS NULL OR v_source = '' THEN
        IF v_role = 'service_role' THEN
            v_source := 'Edge Function';
        ELSIF TG_TABLE_NAME IN (
            'update_news_logs', 'update_news_config', 'public_news_articles', 
            'public_content', 'public_article_cache', 'admin_users', 
            'news_api_keys', 'news_system_config', 'platform_settings', 
            'broadcast_messages', 'support_conversations'
        ) THEN
            v_source := 'Admin Dashboard';
        ELSE
            v_source := 'Client API';
        END IF;
    END IF;

    -- Insert log entry safely
    DECLARE
        v_record_id TEXT;
        v_description TEXT;
    BEGIN
        IF TG_OP = 'DELETE' THEN
            v_record_id := (row_to_json(OLD)::jsonb ->> 'id');
        ELSE
            v_record_id := (row_to_json(NEW)::jsonb ->> 'id');
        END IF;

        IF v_record_id IS NOT NULL THEN
            v_description := TG_OP || ' record #' || v_record_id || ' in ' || TG_TABLE_NAME;
        ELSE
            v_description := TG_OP || ' operation on ' || TG_TABLE_NAME;
        END IF;

        IF TG_OP = 'INSERT' THEN
            INSERT INTO public.activity_logs (table_name, operation, action_type, description, record_id, new_data, changed_by, source)
            VALUES (TG_TABLE_NAME, TG_OP, TG_OP, v_description, v_record_id, row_to_json(NEW)::jsonb, v_user_id, v_source);
        ELSIF TG_OP = 'UPDATE' THEN
            INSERT INTO public.activity_logs (table_name, operation, action_type, description, record_id, old_data, new_data, changed_by, source)
            VALUES (TG_TABLE_NAME, TG_OP, TG_OP, v_description, v_record_id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, v_user_id, v_source);
        ELSIF TG_OP = 'DELETE' THEN
            INSERT INTO public.activity_logs (table_name, operation, action_type, description, record_id, old_data, changed_by, source)
            VALUES (TG_TABLE_NAME, TG_OP, TG_OP, v_description, v_record_id, row_to_json(OLD)::jsonb, v_user_id, v_source);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Never fail main transaction if log insert fails
        NULL;
    END;

    -- Return appropriate record based on operation
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup function to maintain max logs limit dynamically
CREATE OR REPLACE FUNCTION public.clean_old_activity_logs()
RETURNS void AS $$
DECLARE
    v_max_limit INT := 1000;
    v_setting_text TEXT;
BEGIN
    -- Fetch limit from platform_settings safely
    BEGIN
        SELECT setting_value::text INTO v_setting_text
        FROM public.platform_settings
        WHERE setting_key = 'activity_logs_max_limit';

        IF v_setting_text IS NOT NULL THEN
            v_max_limit := (REGEXP_REPLACE(v_setting_text, '[^0-9]', '', 'g'))::INT;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_max_limit := 1000;
    END;

    IF v_max_limit IS NULL OR v_max_limit <= 0 THEN
        v_max_limit := 1000;
    END IF;

    -- Prune records beyond the limit
    DELETE FROM public.activity_logs
    WHERE id NOT IN (
        SELECT id FROM public.activity_logs
        ORDER BY created_at DESC
        LIMIT v_max_limit
    );
EXCEPTION WHEN OTHERS THEN
    NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 3. Create a function to apply the trigger to all existing tables
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.apply_activity_triggers_to_all()
RETURNS void AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename != 'activity_logs'
    LOOP
        -- Drop if exists to avoid duplicates
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'log_activity_' || r.tablename, r.tablename);
        -- Create the trigger
        EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_activity_function()', 'log_activity_' || r.tablename, r.tablename);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to apply triggers to current tables
SELECT public.apply_activity_triggers_to_all();

-- ==============================================================================
-- 4. Create an event trigger to automatically apply the trigger to new tables
-- ==============================================================================
-- Note: Event triggers require superuser privileges. In Supabase, the postgres role has this.
CREATE OR REPLACE FUNCTION public.trg_create_activity_trigger_on_new_table()
RETURNS event_trigger AS $$
DECLARE
    obj record;
    table_name text;
BEGIN
    FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE'
    LOOP
        IF obj.schema_name = 'public' AND obj.object_identity NOT LIKE '%activity_logs%' THEN
            -- Extract table name from object_identity (e.g., 'public.my_table' -> 'my_table')
            table_name := split_part(obj.object_identity, '.', 2);
            EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION public.log_activity_function()', 'log_activity_' || table_name, obj.object_identity);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Drop the event trigger if it exists to avoid errors on re-run
DROP EVENT TRIGGER IF EXISTS auto_add_activity_trigger;

-- Create the event trigger
CREATE EVENT TRIGGER auto_add_activity_trigger
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE')
EXECUTE FUNCTION public.trg_create_activity_trigger_on_new_table();

-- ==============================================================================
-- 5. Admin functions for Settings Page (Truncate, Reset Sequence, Get All Tables)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_truncate_table(target_table_name text)
RETURNS void AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Try to get the user ID from the JWT claims
    BEGIN
        v_user_id := (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    -- Only allow truncating tables in the public schema to prevent abuse
    EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', target_table_name);

    -- Log the truncate operation
    INSERT INTO public.activity_logs (
        table_name, 
        operation, 
        new_data, 
        changed_by
    )
    VALUES (
        target_table_name, 
        'DELETE', 
        jsonb_build_object('description', 'Table data truncated via admin action', 'source', 'Admin'), 
        v_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_reset_sequence(target_table_name text)
RETURNS void AS $$
DECLARE
    seq_name text;
BEGIN
    -- Find the sequence associated with the table's id column
    SELECT pg_get_serial_sequence('public.' || target_table_name, 'id') INTO seq_name;
    
    IF seq_name IS NOT NULL THEN
        EXECUTE format('ALTER SEQUENCE %s RESTART WITH 1', seq_name);
    ELSE
        RAISE EXCEPTION 'No sequence found for column "id" on table "%"', target_table_name;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_all_tables()
RETURNS TABLE(table_name text, has_sequence boolean) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        t.tablename::text,
        EXISTS (
            SELECT 1 
            FROM information_schema.columns c 
            WHERE c.table_schema = 'public' 
              AND c.table_name = t.tablename 
              AND (c.column_default LIKE 'nextval(%' OR c.is_identity = 'YES')
        ) AS has_sequence
    FROM pg_tables t
    WHERE t.schemaname = 'public';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 6. Enable Realtime for activity_logs
-- ==============================================================================
-- This ensures the dashboard updates automatically when new logs are added
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;

-- ==============================================================================
-- 8. Fix RLS Policies for Admin Operations
-- ==============================================================================
-- This section ensures that authenticated users (admins) can perform CRUD operations
-- on the necessary tables. If RLS is enabled, these policies will grant access.

DO $$ 
DECLARE
    t text;
    admin_tables text[] := ARRAY[
        'ai_api_keys', 
        'update_news_config', 
        'update_news_logs', 
        'public_news_articles', 
        'activity_logs'
    ];
BEGIN
    FOREACH t IN ARRAY admin_tables
    LOOP
        -- Enable RLS just in case it's not enabled, so we can apply policies
        EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY;', t);
        
        -- Drop existing policies to avoid conflicts
        EXECUTE format('DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.%I;', t);
        
        -- Create a policy that allows ALL operations (SELECT, INSERT, UPDATE, DELETE) for authenticated users
        EXECUTE format('CREATE POLICY "Allow full access to authenticated users" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);', t);
    END LOOP;
END $$;
-- ==============================================================================
-- 7. Frontend Logging Function
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.log_frontend_activity(
    p_table_name text,
    p_action_type text,
    p_description text,
    p_source text,
    p_payload jsonb DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Try to get the user ID from the JWT claims
    BEGIN
        v_user_id := (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    INSERT INTO public.activity_logs (
        table_name, 
        operation, 
        new_data, 
        changed_by
    )
    VALUES (
        p_table_name, 
        p_action_type, 
        jsonb_build_object('description', p_description, 'source', p_source, 'payload', p_payload), 
        v_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
