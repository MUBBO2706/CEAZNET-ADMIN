// supabase/functions/update-news/supabase.ts: Supabase client and helper functions.
// @ts-nocheck - This is a Deno file and should not be type-checked by the frontend's TypeScript compiler.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are not set.");
  }

  export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Helper functions for updating key stats
  export const incrementKeyCalls = async (keyId: string) => {
      await supabaseAdmin.rpc('increment_news_key_calls', { key_id: keyId });
      };

      export const incrementKeyFailures = async (keyId: string, maxFailures: number = 3) => {
          await supabaseAdmin.rpc('increment_news_key_failures', { key_id: keyId, max_failures: maxFailures });
          };
