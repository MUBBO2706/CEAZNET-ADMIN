import { dbMain } from './supabaseService';

export interface SupportConversation {
    id: string;
    user_id: string;
    type: 'chat' | 'mail';
    subject?: string;
    status: 'open' | 'closed' | 'pending';
    created_at: string;
    updated_at: string;
}

export interface SupportMessage {
    id: string;
    conversation_id: string;
    sender_id: string;
    sender_type: 'user' | 'admin';
    message: string;
    is_read: boolean;
    read_at?: string;
    created_at: string;
    attachment_url?: string;
    attachment_name?: string;
    attachment_type?: string;
}

export async function fetchConversations(limit: number = 100): Promise<SupportConversation[]> {
    const { data, error } = await dbMain
        .from('support_conversations')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(limit);
    
    if (error) {
        console.error("Error fetching conversations:", error);
        return [];
    }
    return data as SupportConversation[];
}

export async function searchConversations(query: string): Promise<SupportConversation[]> {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);
    
    let dbQuery = dbMain.from('support_conversations').select('*');
    if (isUUID) {
        dbQuery = dbQuery.or(`id.eq.${query},user_id.eq.${query}`);
    } else {
        dbQuery = dbQuery.ilike('subject', `%${query}%`);
    }
    
    const { data, error } = await dbQuery.order('updated_at', { ascending: false }).limit(20);
    
    if (error) {
        console.error("Error searching conversations:", error);
        return [];
    }
    return data as SupportConversation[];
}

export async function fetchMessages(conversationId: string): Promise<SupportMessage[]> {
    const { data, error } = await dbMain
        .from('support_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
    
    if (error) {
        console.error("Error fetching messages:", error);
        return [];
    }
    return data as SupportMessage[];
}

export async function markMessagesAsRead(conversationId: string) {
    const { error } = await dbMain
        .from('support_messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'user')
        .eq('is_read', false);
        
    if (error) {
        console.error("Error marking messages as read:", error);
    }
}

export async function sendAdminMessage(conversationId: string, adminId: string | null, messageText: string) {
    const { data, error } = await dbMain
        .from('support_messages')
        .insert({
            conversation_id: conversationId,
            sender_id: adminId,
            sender_type: 'admin',
            message: messageText
        })
        .select()
        .single();
        
    if (error) {
        console.error("Error sending admin message:", error);
        throw error;
    }
    
    // Also update the conversation's updated_at timestamp
    await dbMain
        .from('support_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
        
    return data;
}

export async function updateConversationStatus(conversationId: string, status: 'open' | 'closed' | 'pending') {
    const { error } = await dbMain
        .from('support_conversations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
        
    if (error) {
        console.error("Error updating conversation status:", error);
        throw error;
    }
}
