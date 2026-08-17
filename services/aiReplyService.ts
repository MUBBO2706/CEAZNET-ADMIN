import { GoogleGenAI } from '@google/genai';
import { dbMain } from './supabaseService';
import { SupportMessage } from './supportInboxService';

export async function generateSupportReply(
    messages: SupportMessage[],
    customInstructions: string = "",
    model: string = "gemini-3.1-flash-lite"
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

    // Strict isolation: ensure only messages belonging to this current chat are processed
    const formattedHistory = messages.map(m => {
        const isAdmin = m.sender_type === 'admin';
        return `${isAdmin ? 'Support' : 'User'}: ${m.message || (m.attachment_url ? '[Attachment: ' + (m.attachment_name || 'File') + ']' : '')}`;
    }).filter(Boolean).join('\n\n');

    const systemPrompt = `You are a professional, helpful customer support representative writing on behalf of Ceaznet Support.

STRICT CONTEXT ISOLATION RULES:
1. Focus EXCLUSIVELY and ONLY on the conversation history of THIS particular support ticket / chat thread provided below.
2. DO NOT refer to, assume, hallucinate, or incorporate any context, issues, or history from other tickets or external conversations of this user.
3. Every response must address solely the exact query, issue, or question raised in this specific chat thread.

VOICE AND TONE GUIDELINES:
1. Speak on behalf of the support team: ALWAYS use collective plural pronouns ("We", "Us", "Our") instead of singular pronouns ("I", "Me", "My").
2. Maintain a warm, empathetic, polite, respectful, and highly competent professional tone.
3. Keep answers clear, direct, and actionable. Do not add generic placeholders like "[Your Name]" or "[Agent Name]" (sign off as "Ceaznet Support Team" if needed).

MANDATORY MARKDOWN FORMATTING RULES:
1. You MUST actively format your response using clean, structured Markdown.
2. Use **bold** formatting for essential terms, steps, transaction details, statuses, or emphasis.
3. Use bullet lists (- or *) or numbered lists (1., 2., 3.) whenever listing solutions, steps, troubleshooting instructions, or multiple options.
4. Use inline code (\`like this\`) for technical IDs, transaction hashes, wallet addresses, URLs, error codes, or account identifiers.
5. Use code blocks (\`\`\`...\`\`\`) if presenting code snippets, JSON, or configuration data.
6. Use clean paragraph separation with double newlines for optimal readability.

Based on the conversation history of this specific support ticket below, generate a comprehensive, accurate, and neatly Markdown-formatted response:
${customInstructions ? `\nAdmin custom instructions / draft: ${customInstructions}` : ''}`;

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
