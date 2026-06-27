// supabase/functions/update-news/index.ts: Main entry point for the news update edge function.
// @ts-nocheck - This is a Deno file and should not be type-checked by the frontend's TypeScript compiler.
import { serve } from "https://deno.land/std/http/server.ts";
import { Logger } from './logger.ts';
import { corsHeaders } from './utils.ts';
import { processNewsCategory } from './news.ts';
import { sendEmailLog } from './email.ts';
import { supabaseAdmin } from './supabase.ts';

const CATEGORIES = ['technology', 'business', 'science', 'health', 'sports', 'entertainment'];
const BATCH_SIZE = 1; // Must be 1 to prevent 429 Too Many Requests from GNews Free Tier (1 req/sec)

function chunkArray(array, size) {
  const chunkedArr = [];
    for(let i = 0; i < array.length; i += size){
        chunkedArr.push(array.slice(i, i + size));
          }
            return chunkedArr;
            }

            serve(async (req)=>{
              if (req.method === 'OPTIONS') {
                  return new Response('ok', { headers: corsHeaders });
                    }
                      const logger = new Logger();
                        let overallStatus = 'SUCCESS';
                          const startTime = Date.now();
                            try {
                                logger.info('🚀 Starting news update process...');
                                
                                // Set running status to true
                                await supabaseAdmin
                                  .from('news_system_config')
                                  .upsert({ config_key: 'is_news_updating', config_value: true, updated_at: new Date() }, { onConflict: 'config_key' });
                                    
                                        // Fetch API keys from the NEW news_api_keys table
                                            const { data: keysData, error: keysError } = await supabaseAdmin
                                                  .from('news_api_keys')
                                                        .select('*')
                                                              .eq('status', 'active');

                                                                  if (keysError || !keysData) {
                                                                        throw new Error(`Failed to fetch keys from DB: ${keysError?.message}`);
                                                                            }

                                                                                const gnews_keys = keysData.filter(k => k.provider === 'gnews');
                                                                                    const gemini_keys = keysData.filter(k => k.provider === 'gemini');

                                                                                        if (gnews_keys.length === 0 || gemini_keys.length === 0) {
                                                                                              throw new Error('Active API keys for GNews or Gemini are not configured in the database.');
                                                                                                  }

                                                                                                      logger.info('🧹 Clearing old article data...');
                                                                                                          await Promise.all([
                                                                                                                supabaseAdmin.from('article_conversations').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                                                                                                                      supabaseAdmin.from('public_article_cache').delete().neq('article_url', 'dummy_url_to_avoid_empty_delete'),
                                                                                                                            supabaseAdmin.from('user_article_interactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
                                                                                                                                ]);
                                                                                                                                    logger.success('✅ Cleared old data.');

                                                                                                                                        const categoryBatches = chunkArray(CATEGORIES, BATCH_SIZE);
                                                                                                                                            const allResults = [];
                                                                                                                                                logger.info(`Processing ${CATEGORIES.length} categories in ${categoryBatches.length} batches of ${BATCH_SIZE}...`);
                                                                                                                                                    
                                                                                                                                                        for (const batch of categoryBatches){
    logger.info(`Processing batch: [${batch.join(', ')}]`);
    const batchResults = await Promise.all(batch.map((category)=>processNewsCategory(category, logger, gnews_keys, gemini_keys)));
    allResults.push(...batchResults);
    await new Promise(res => setTimeout(res, 2000));
}

                                                                                                                                                                                  let totalArticlesUpdated = 0;
                                                                                                                                                                                      allResults.forEach((result)=>{
                                                                                                                                                                                            if (result.success) {
                                                                                                                                                                                                    totalArticlesUpdated += result.articlesUpdated;
                                                                                                                                                                                                          } else {
                                                                                                                                                                                                                  overallStatus = 'FAILURE';
                                                                                                                                                                                                                        }
                                                                                                                                                                                                                            });

                                                                                                                                                                                                                                logger.info('✅ News update process finished.');
                                                                                                                                                                                                                                    logger.addSummary(`Total Articles Updated: ${totalArticlesUpdated}`);
                                                                                                                                                                                                                                        
                                                                                                                                                                                                                                            return new Response(JSON.stringify({ message: 'News update completed successfully.' }), {
                                                                                                                                                                                                                                                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                                                                                                                                                                                                                                                        status: 200
                                                                                                                                                                                                                                                            });
                                                                                                                                                                                                                                                              } catch (error) {
                                                                                                                                                                                                                                                                  overallStatus = 'FAILURE';
                                                                                                                                                                                                                                                                      logger.error(`🚨 CRITICAL ERROR in main process: ${error.message}`);
                                                                                                                                                                                                                                                                          return new Response(JSON.stringify({ error: error.message }), {
                                                                                                                                                                                                                                                                                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                                                                                                                                                                                                                                                                                      status: 500
                                                                                                                                                                                                                                                                                          });
                                                                                                                                                                                                                                                                                            } finally{
                                                                                                                                                                                                                                                                                                const duration_ms = Date.now() - startTime;
                                                                                                                                                                                                                                                                                                    logger.info(`Total execution time: ${duration_ms}ms`);
                                                                                                                                                                                                                                                                                                        const { error: logError } = await supabaseAdmin.from('update_news_logs').insert({
                                                                                                                                                                                                                                                                                                              status: overallStatus,
                                                                                                                                                                                                                                                                                                                    duration_ms,
                                                                                                                                                                                                                                                                                                                          summary: logger.getSummary(),
                                                                                                                                                                                                                                                                                                                                details: logger.getLogs().join('\n')
                                                                                                                                                                                                                                                                                                                                    });
                                                                                                                                                                                                                                                                                                                                        if (logError) console.error("Failed to write log to database:", logError.message);
                                                                                                                                                                                                                                                                                                             
                                                                                                                                                                                                                                                                                                                 // Set running status to false
                                                                                                                                                                                                                                                                                                                 await supabaseAdmin
                                                                                                                                                                                                                                                                                                                   .from('news_system_config')
                                                                                                                                                                                                                                                                                                                   .upsert({ config_key: 'is_news_updating', config_value: false, updated_at: new Date() }, { onConflict: 'config_key' });
                                                                                                                                                                                                                                                                                                                                            
                                                                                                                                                                                                                                                                                                                                                logger.info('📤 Preparing and sending email log...');
                                                                                                                                                                                                                                                                                                                                                    await sendEmailLog(logger, overallStatus);
                                                                                                                                                                                                                                                                                                                                                        logger.info("Email log process complete. Function finished.");
                                                                                                                                                                                                                                                                                                                                                          }
                                                                                                                                                                                                                                                                                                                                                          });
