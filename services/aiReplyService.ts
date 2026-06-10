import { GoogleGenAI } from '@google/genai';
import { dbMain } from './supabaseService';
import { SupportMessage } from './supportInboxService';

export async function generateSupportReply(
    messages: SupportMessage[],
    customInstructions: string = "",
    model: string = "gemini-2.5-pro"
): Promise<string> {
    const { data: keysData, error: keysError } = await dbMain
        .from('news_api_keys')
        .select('*')
        .eq('provider', 'gemini')
        .eq('status', 'active')
        .order('calls_count', { ascending: true });
    
    if (keysError || !keysData || keysData.length === 0) {
        console.error("Failed to fetch Gemini API Keys from database:", keysError);
        throw new Error("Unable to access Gemini API. Keys might be exhausted or unavailable.");
    }

    // Format conversation history
    const formattedHistory = messages.map(m => {
        const isAdmin = m.sender_type === 'admin';
        return `${isAdmin ? 'Support' : 'User'}: ${m.message}`;
    }).join('\n\n');

    const systemPrompt = `You are a helpful, professional customer support agent.
Based on the following conversation history, generate a polite and helpful response to the user's latest message.
Keep the response concise, clear, and empathetic. Do not include placeholders like "[Your Name]" or generic sign-offs unless appropriate.
${customInstructions ? `\nAdditional instructions from admin: ${customInstructions}` : ''}`;

    let replyText = "";
    let success = false;
    let lastError: any = null;

    for (const keyObj of keysData) {
        try {
            const ai = new GoogleGenAI({ apiKey: keyObj.api_key });

            const response = await ai.models.generateContent({
                model: model,
                contents: [
                    { role: 'user', parts: [{ text: systemPrompt + '\n\nConversation History:\n' + formattedHistory }] }
                ],
                config: {
                    temperature: 0.7,
                }
            });

            replyText = response.text || "";
            success = true;

            // Increment call count
            const { error: resetError } = await dbMain.rpc('perform_lazy_daily_reset', { p_provider: 'gemini' });
            if (resetError) {
                console.warn("Could not lazily reset counts:", resetError);
            }
            
            const { data: existing } = await dbMain.from('news_api_keys').select('calls_count').eq('id', keyObj.id).single();
            if (existing) {
                await dbMain.from('news_api_keys').update({ 
                    calls_count: (existing.calls_count || 0) + 1,
                    updated_at: new Date().toISOString()
                }).eq('id', keyObj.id);
            }

            break;
        } catch (error) {
            lastError = error;
            console.error(`Gemini key ...${keyObj.api_key?.slice(-4)} failed:`, error);
            
            const { data: existing } = await dbMain.from('news_api_keys').select('failure_count').eq('id', keyObj.id).single();
            if (existing) {
                const newFailureCount = (existing.failure_count || 0) + 1;
                const status = newFailureCount >= 3 ? 'exhausted' : 'active';
                await dbMain.from('news_api_keys').update({ 
                    failure_count: newFailureCount,
                    status: status,
                    updated_at: new Date().toISOString()
                }).eq('id', keyObj.id);
            }
        }
    }

    if (!success) {
        throw new Error(`Failed to generate reply with AI. Error: ${lastError?.message || "All keys hit a quota or encountered an issue."}`);
    }
    
    return replyText;
}
