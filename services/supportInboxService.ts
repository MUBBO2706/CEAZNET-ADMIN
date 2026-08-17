import { dbMain } from './supabaseService';
import { deleteTelegramAttachments } from './attachmentUploadService';

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
    try {
        const { data, error } = await dbMain
            .from('support_conversations')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(limit);
        
        if (error) {
            console.error("Error fetching conversations:", error);
            return [];
        }
        return (data || []) as SupportConversation[];
    } catch (err) {
        console.error("Error fetching conversations:", err);
        return [];
    }
}

export async function searchConversations(query: string): Promise<SupportConversation[]> {
    try {
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
        return (data || []) as SupportConversation[];
    } catch (err) {
        console.error("Error searching conversations:", err);
        return [];
    }
}

export async function fetchMessages(conversationId: string): Promise<SupportMessage[]> {
    try {
        const { data, error } = await dbMain
            .from('support_messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });
        
        if (error) {
            console.error("Error fetching messages:", error);
            return [];
        }
        return (data || []) as SupportMessage[];
    } catch (err) {
        console.error("Error fetching messages:", err);
        return [];
    }
}

export async function markMessagesAsRead(conversationId: string) {
    try {
        const { error } = await dbMain
            .from('support_messages')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .eq('sender_type', 'user')
            .eq('is_read', false);
            
        if (error) {
            console.error("Error marking messages as read:", error);
        }
    } catch (err) {
        console.error("Error marking messages as read:", err);
    }
}

export async function sendAdminMessage(
    conversationId: string, 
    adminId: string | null, 
    messageText: string,
    attachment?: {
        attachment_url?: string;
        attachment_name?: string;
        attachment_type?: string;
    }
) {
    try {
        const payload: any = {
            conversation_id: conversationId,
            sender_id: adminId,
            sender_type: 'admin',
            message: messageText
        };

        if (attachment?.attachment_url) {
            payload.attachment_url = attachment.attachment_url;
            payload.attachment_name = attachment.attachment_name || 'attachment';
            payload.attachment_type = attachment.attachment_type || 'application/octet-stream';
        }

        const { data, error } = await dbMain
            .from('support_messages')
            .insert(payload)
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
            
        return data as SupportMessage;
    } catch (err) {
        console.error("Error sending admin message:", err);
        throw err;
    }
}

export async function updateConversationStatus(conversationId: string, status: 'open' | 'closed' | 'pending') {
    try {
        const { error } = await dbMain
            .from('support_conversations')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', conversationId);
            
        if (error) {
            console.error("Error updating conversation status:", error);
            throw error;
        }
    } catch (err) {
        console.error("Error updating conversation status:", err);
        throw err;
    }
}

export async function deleteConversation(conversationId: string): Promise<boolean> {
    try {
        // 1. Fetch all messages in the conversation to retrieve attachments
        const { data: messages, error: fetchError } = await dbMain
            .from('support_messages')
            .select('id, attachment_url')
            .eq('conversation_id', conversationId);

        if (fetchError) {
            console.warn("Could not fetch messages for deletion, proceeding with DB cascade:", fetchError);
        }

        // 2. Delete attachments from Telegram in background
        if (messages && messages.length > 0) {
            const attachmentUrls = messages
                .map(m => m.attachment_url)
                .filter(Boolean) as string[];

            if (attachmentUrls.length > 0) {
                try {
                    await deleteTelegramAttachments(attachmentUrls);
                } catch (tgErr) {
                    console.error("Failed to delete some Telegram attachments:", tgErr);
                }
            }
        }

        // 3. Delete messages from Supabase
        const { error: msgDeleteError } = await dbMain
            .from('support_messages')
            .delete()
            .eq('conversation_id', conversationId);

        if (msgDeleteError) {
            console.error("Error deleting conversation messages:", msgDeleteError);
        }

        // 4. Delete the conversation record from Supabase
        const { error: convDeleteError } = await dbMain
            .from('support_conversations')
            .delete()
            .eq('id', conversationId);

        if (convDeleteError) {
            console.error("Error deleting conversation:", convDeleteError);
            throw convDeleteError;
        }

        return true;
    } catch (err) {
        console.error("Error deleting conversation:", err);
        throw err;
    }
}

export async function deleteSingleMessage(messageId: string, attachmentUrl?: string): Promise<boolean> {
    try {
        if (attachmentUrl) {
            try {
                await deleteTelegramAttachments([attachmentUrl]);
            } catch (tgErr) {
                console.error("Failed to delete message attachment from Telegram:", tgErr);
            }
        }

        const { error } = await dbMain
            .from('support_messages')
            .delete()
            .eq('id', messageId);

        if (error) {
            console.error("Error deleting message:", error);
            throw error;
        }

        return true;
    } catch (err) {
        console.error("Error in deleteSingleMessage:", err);
        throw err;
    }
}

