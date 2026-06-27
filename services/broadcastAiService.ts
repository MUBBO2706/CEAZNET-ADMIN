import { GoogleGenAI } from '@google/genai';
import { dbMain } from './supabaseService';

export interface BroadcastIteration {
    role: 'user' | 'model';
    content: string;
}

const SYSTEM_PROMPT = `You are an expert AI frontend designer and copywriter. 
Your task is to take the admin's broadcast message or instruction and generate a SINGLE, BEAUTIFUL, responsive HTML snippet.
This HTML will be injected directly into a popup modal inside a user-facing client application.
The HTML should NOT contain <html>, <head>, or <body> tags. It should just be a <div> wrapper containing the content.
Use inline styles or standard CSS classes. Create MORE ATTRACTIVE AND UNIQUE layouts. Do not hesitate to use modern, clean, and engaging design with smooth gradients, shadows, and spacing.
CRITICAL HALLUCINATION PREVENTION: You must NEVER invent or hallucinate features, URLs, or information that is not explicitly provided in the prompt. Stick STRICTLY to the provided facts and content.
CRITICAL RESPONSIVENESS INSTRUCTION: The layout MUST be 100% responsive. Use a container-less layout paradigm. Avoid fixed widths or fixed heights. It must display perfectly on mobile devices without causing any vertical or horizontal scrolling inside the popup. Ensure all text and elements wrap or scale gracefully. Use flexible units (e.g., %, vw, vh, rem).
Include context-appropriate icons (prefer inline SVG icons formatted beautifully, avoid external icon library dependencies if possible).
CRITICAL: You MUST include JavaScript functions in a <script> block if the broadcast requires interaction (e.g., form validations, interactive states, Confetti animations, interactive buttons). Write functional and self-contained JavaScript for everything requested.
CRITICAL INSTRUCTION FOR BUTTONS: When generating the HTML for a Broadcast Popup, if you include a 'close', 'dismiss', or 'Got it!' button, you MUST add the exact attribute data-close-broadcast="true" to that button element. Alternatively, you can use onclick="window.closeBroadcastPopup()". This is strictly required so that clicking the button successfully closes the modal in the frontend and correctly marks it as 'read' in the local storage for refresh sync.
Example format you must follow:
<button data-close-broadcast="true" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">Samajh Gaya</button>

CRITICAL FORMAT REQUIREMENT: You MUST ALWAYS begin your response with a <thought>...</thought> block where you briefly explain what you are going to design (e.g., "<thought>I will use a red background and a modern button.</thought>"). Do not output any HTML before the thought block finishes. After </thought>, output ONLY the raw HTML.
If the user provides an iteration instruction (like "make it red", "add a button"), incorporate it into the previous generated HTML.
ALWAYS return ONLY the raw HTML after the thought block. Do NOT wrap it in markdown code blocks (\`\`\`html) as it will be parsed directly. Just output the HTML.`;

export async function generateBroadcastHtml(
    newPrompt: string, 
    history: BroadcastIteration[] = [],
    model: string = 'gemini-3.1-flash-lite',
    onThoughtStream?: (thought: string) => void
): Promise<string> {
    // Fetch API keys for gemini directly from the table
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

    let cleanHtml = "";
    let success = false;
    let lastError: any = null;

    // Try rotational keys
    for (const keyObj of keysData) {
        try {
            const ai = new GoogleGenAI({ apiKey: keyObj.api_key });

            const contents = [
                { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
                { role: 'model', parts: [{ text: "Understood. I will output only raw HTML for the broadcast modal." }] }
            ];

            // Append history
            for (const msg of history) {
                contents.push({
                    role: msg.role,
                    parts: [{ text: msg.content }]
                });
            }

            // Add the new prompt
            contents.push({
                role: 'user',
                parts: [{ text: newPrompt }]
            });

            const responseStream = await ai.models.generateContentStream({
                model: model, // Use dynamically selected model
                contents: contents,
                config: {
                    temperature: 0.7,
                }
            });

            let fullResponse = '';
            for await (const chunk of responseStream) {
                const chunkText = typeof (chunk as any).text === 'function' ? (chunk as any).text() : (chunk as any).text || "";
                fullResponse += chunkText;
                
                if (onThoughtStream) {
                    const thoughtMatch = fullResponse.match(/<thought>([\s\S]*?)(?:<\/thought>|$)/i);
                    let parsedThought = thoughtMatch ? thoughtMatch[1].trim() : '';
                    if (!parsedThought && fullResponse.length < 50 && !fullResponse.includes('<thought>')) {
                        parsedThought = fullResponse.trim();
                    }
                    if (parsedThought) {
                         onThoughtStream(parsedThought);
                    }
                }
            }

            const textResponse = fullResponse;
            let rawHtmlPart = textResponse;
            if (rawHtmlPart.includes('</thought>')) {
                rawHtmlPart = rawHtmlPart.split('</thought>')[1];
            }
            
            cleanHtml = rawHtmlPart.replace(/^```(html|xml)?\n?/gi, '').replace(/```$/g, '').trim();
            success = true;

            // Increment call count
            const { error: resetError } = await dbMain.rpc('perform_lazy_daily_reset', { p_provider: 'gemini' });
            if (resetError) {
                console.warn("Could not lazily reset counts:", resetError);
            }
            
            // Try updating standard call count fields using direct update or rpc fallback
            const { data: existing } = await dbMain.from('news_api_keys').select('calls_count').eq('id', keyObj.id).single();
            if (existing) {
                await dbMain.from('news_api_keys').update({ 
                    calls_count: (existing.calls_count || 0) + 1,
                    updated_at: new Date().toISOString()
                }).eq('id', keyObj.id);
            }

            break; // Stop on first successful key
        } catch (error) {
            lastError = error;
            console.error(`Gemini key ...${keyObj.api_key.slice(-4)} failed:`, error);
            
            // Update failure count
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
            continue; // Go to next key
        }
    }

    if (!success) {
        throw new Error(`Failed to generate HTML with AI. Error: ${lastError?.message || "All keys hit a quota or encountered an issue."}`);
    }
    
    return cleanHtml;
}

export async function deleteBroadcast(id: string): Promise<boolean> {
    try {
        const { error } = await dbMain
            .from('broadcasts')
            .delete()
            .eq('id', id);

        if (error) {
            console.error("Error deleting broadcast:", error);
            return false;
        }
        return true;
    } catch (e) {
        console.error("Exception deleting broadcast:", e);
        return false;
    }
}

export async function fetchSystemBanner() {
    try {
        const { data, error } = await dbMain
            .from('broadcasts')
            .select('*')
            .eq('id', '11111111-1111-1111-1111-111111111111')
            .single();
            
        if (error) {
            console.error("Error fetching system banner:", error);
            return null;
        }
        return data;
    } catch (e) {
        console.error("Exception fetching system banner:", e);
        return null;
    }
}

export async function fetchBroadcastHistory() {
    try {
        const { data, error } = await dbMain
            .from('broadcasts')
            .select('*')
            .order('sent_at', { ascending: false })
            .limit(50);
            
        if (error) {
            console.error("Error fetching broadcast history:", error);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error("Exception fetching broadcast history:", e);
        return [];
    }
}

export async function upsertSystemBanner(bannerType: string, isActive: boolean): Promise<boolean> {
    try {
        const { error } = await dbMain
            .from('broadcasts')
            .upsert({
                id: '11111111-1111-1111-1111-111111111111', // Dummy fixed UUID for the single banner row
                type: 'system_banner',
                banner_type: bannerType,
                is_active: isActive,
                status: 'sent',
                title: 'System Banner',
                raw_html: '',
                sent_at: new Date().toISOString()
            });

        if (error) {
            console.error("Failed to upsert system banner", error);
            return false;
        }
        return true;
    } catch (e) {
        console.error("Exception upserting system banner", e);
        return false;
    }
}

export async function publishBroadcast(rawHtml: string, title: string = 'AI Generated Broadcast', history: BroadcastIteration[] = [], expiresAt: string | null = null, type: 'popup' | 'system_banner' = 'popup'): Promise<boolean> {
    try {
        const { data: broadcast, error: broadcastError } = await dbMain
            .from('broadcasts')
            .insert({
                title,
                raw_html: rawHtml,
                status: 'sent',
                type: type,
                sent_at: new Date().toISOString(),
                ...(expiresAt ? { expires_at: expiresAt } : {})
            })
            .select()
            .single();

        if (broadcastError || !broadcast) {
            console.warn("Failed to log broadcast to DB", broadcastError);
            return false;
        }

        if (history.length > 0) {
            const historyInserts = history.map(item => ({
                broadcast_id: broadcast.id,
                role: item.role,
                content: item.content
            }));
            // Fire and forget
            dbMain.from('broadcast_iterations').insert(historyInserts).then();
        }
        
        return true;
    } catch (e) {
        console.warn("Failed to save broadcast context", e);
        return false;
    }
}
