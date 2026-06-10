// supabase/functions/update-news/utils.ts: Contains shared utility functions.
// @ts-nocheck - This is a Deno file and should not be type-checked by the frontend's TypeScript compiler.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
    };
    export const delay = (ms)=>new Promise((resolve)=>setTimeout(resolve, ms));
