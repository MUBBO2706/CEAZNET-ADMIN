import { GoogleGenAI } from '@google/genai';
import { dbMain } from './supabaseService';

export interface BroadcastIteration {
    role: 'user' | 'model';
    content: string;
}

const SYSTEM_PROMPT = `You are an elite frontend UI/UX engineer and design expert specializing in user-facing client notification popups and in-app announcements.

Your mission is to generate a SINGLE, FLAWLESS, COMPACT, AND HIGH-CONVERTING HTML popup snippet based on the admin's instructions.
The output HTML will be injected directly into a client app that already provides a centered transparent dark/blur backdrop overlay.

================================================================
CRITICAL STRUCTURAL & SIZING RULES (STRICT - ZERO TOLERANCE)
================================================================

1. CONTAINER-LESS ROOT STRUCTURE (NO REDUNDANT FULL-SCREEN OVERLAYS):
   - The client application ALREADY wraps the popup in a centered, fixed, transparent backdrop overlay (<div class="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">).
   - DO NOT generate full-screen overlays, fixed overlays, 'fixed inset-0', 'w-screen', 'h-screen', or 100vw/100vh outer wrapper containers!
   - The outermost root element MUST be a SINGLE, direct card container: <div class="..."> containing only the actual popup card content.
   - Do NOT create unnecessary nested shell containers or redundant outer borders. The card must appear cleanly directly on the client's transparent backdrop.
   - Do NOT include <html>, <head>, <!DOCTYPE>, or <body> tags.

2. DESKTOP POPUP-CENTRIC SIZING (STRICT - NEVER WIDE):
   - On desktop, the popup MUST be centric, focused, and compact (card width strictly between 380px and 460px, max-width: 460px / 90vw).
   - NEVER stretch horizontally across the desktop screen or generate wide landscape banners. It must always look like an elegant, focused dialog/modal.

3. MOBILE COMPACT SIZING (STRICT - NEVER EXCESSIVELY TALL / HIGHTED):
   - On mobile screens, the card MUST be compact, proportional, and never tall or bloated (maximum height: 80vh).
   - Avoid huge hero illustrations, gigantic vertical margins, or bloated paddings that push buttons offscreen or force vertical scrolling.
   - Use sensible, compact spacing (e.g., p-4 to p-5, gap-2.5 to gap-3, font sizes from 13px to 17px).
   - All text, icons, and action buttons must comfortably fit inside the mobile viewport.

4. DESIGN & STYLING AESTHETICS:
   - Use Tailwind CSS classes and/or clean inline CSS.
   - Give the root card container a modern background (e.g. dark slate/zinc bg-zinc-900 or crisp light bg-white), rounded corners (rounded-2xl or rounded-xl), a subtle border (border border-white/10 or border-slate-200), and a rich drop-shadow (shadow-2xl).
   - Use crisp typography, high-contrast text, beautiful badges, and inline SVG icons for visual interest.
   - Do NOT use external icon font libraries (like FontAwesome) or unverified external assets; use self-contained inline SVG icons.

5. BUTTONS & DISMISSAL ACTION (MANDATORY):
   - Every dismiss / close / confirm / "Got it!" / "OK" button MUST have either:
     - data-close-broadcast="true" attribute (e.g., <button data-close-broadcast="true" class="...">Got it</button>)
     - OR onclick="window.closeBroadcastPopup()"
   - If a top-right 'X' close button is included, it MUST also have data-close-broadcast="true" or onclick="window.closeBroadcastPopup()".
   - For CTA buttons (like "Update Now" or "Learn More"), use standard href links or actionable onclick handlers.

6. FUNCTIONAL JAVASCRIPT:
   - If interactive features (e.g. countdown timers, copy-to-clipboard, form validation, celebratory confetti) are requested, place the logic in a clean <script> tag at the end of the snippet.

================================================================
STRICT ITERATION & SURGICAL PRESERVATION RULES
================================================================
When you are given an existing broadcast or previous iteration context:
1. SURGICAL PRESERVATION: You MUST strictly preserve the layout, design system, colors, animations, icons, and attributes of the previous HTML UNLESS the user explicitly asks to change them!
2. NO UNWANTED TOTAL REWRITES: Do NOT replace the entire UI layout or style when the user only asked for a minor tweak (e.g., "change text to...", "make button purple", "add a countdown timer"). Apply surgical updates directly to the existing raw HTML.
3. ALWAYS RETURN COMPLETE HTML: Always output the complete, updated HTML snippet with the changes incorporated.

================================================================
RESPONSE FORMAT (STRICT)
================================================================
You MUST ALWAYS structure your answer as:
<thought>
Concise 1-2 sentence explanation of your design decisions or surgical changes.
</thought>
[RAW HTML SNIPPET ONLY - DO NOT USE MARKDOWN CODE BLOCKS (\`\`\`html)]`;

export async function generateBroadcastHtml(
    newPrompt: string, 
    history: BroadcastIteration[] = [],
    model: string = 'gemini-3.7-flash',
    onThoughtStream?: (thought: string) => void,
    currentRawHtml?: string | null
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

            const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [
                { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
                { role: 'model', parts: [{ text: "Understood. I will strictly follow all layout, container-less, desktop popup-centric, mobile compact, and surgical iteration rules. I will output only raw HTML for the broadcast modal." }] }
            ];

            // Append all previous iterations in chronological order
            for (const msg of history) {
                contents.push({
                    role: msg.role,
                    parts: [{ text: msg.content }]
                });
            }

            // If we have a current raw HTML that is not already at the end of history, provide it clearly
            let promptToSend = newPrompt;
            if (currentRawHtml && (history.length === 0 || history[history.length - 1].content !== currentRawHtml)) {
                promptToSend = `[BASE BROADCAST HTML TO ITERATE ON]:\n${currentRawHtml}\n\n[USER REFINEMENT INSTRUCTION]:\n${newPrompt}`;
            }

            // Add the new prompt
            contents.push({
                role: 'user',
                parts: [{ text: promptToSend }]
            });

            const responseStream = await ai.models.generateContentStream({
                model: model || 'gemini-3.7-flash',
                contents: contents,
                config: {
                    temperature: 0.5,
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

export async function fetchBroadcastIterations(broadcastId: string): Promise<BroadcastIteration[]> {
    try {
        const { data, error } = await dbMain
            .from('broadcast_iterations')
            .select('role, content, created_at')
            .eq('broadcast_id', broadcastId)
            .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
            return data.map((item: any) => ({
                role: item.role as 'user' | 'model',
                content: item.content
            }));
        }
    } catch (e) {
        console.warn("Exception fetching broadcast iterations:", e);
    }
    return [];
}

export async function toggleBroadcastActive(id: string, isActive: boolean): Promise<boolean> {
    try {
        const { error } = await dbMain
            .from('broadcasts')
            .update({ is_active: isActive })
            .eq('id', id);

        if (error) {
            console.error("Error toggling broadcast active:", error);
            return false;
        }
        return true;
    } catch (e) {
        console.error("Exception toggling broadcast active:", e);
        return false;
    }
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
                is_active: true,
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

