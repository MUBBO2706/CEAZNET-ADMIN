import { createClient } from '@supabase/supabase-js';

const isDev = process.env.NODE_ENV !== 'production';
const MAIN_SUPABASE_URL = process.env.VITE_MAIN_SUPABASE_URL || (isDev ? 'https://itjurgqbvsqniphuehiz.supabase.co' : '');
const MAIN_SUPABASE_SERVICE_KEY = process.env.VITE_MAIN_SUPABASE_SERVICE_KEY || (isDev ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI4Mzk1OCwiZXhwIjoyMDkwODU5OTU4fQ.FgnMsY9Oz2ITeBTg3wyldmftSV6c9rYeScx_hC0Syxc' : '');
const dbMain = createClient(MAIN_SUPABASE_URL || 'https://placeholder.supabase.co', MAIN_SUPABASE_SERVICE_KEY || 'placeholder-key');

async function check() {
    try {
        console.log("Fetching user...");
        const res = await dbMain.auth.getUser();
        console.log(res);
    } catch (e: any) {
        console.error("Caught error:", e.message);
    }
}
check();
