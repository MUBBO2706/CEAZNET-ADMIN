export interface UploadedAttachment {
    attachment_url: string;
    attachment_name: string;
    attachment_type: string;
}

const DEFAULT_BOT_TOKEN = "8651559829:AAE8dajbB7yB9Nc8WYxV-b4lBp8z0CBTLC8";
const DEFAULT_CHANNEL_ID = "-1002341258674";

export async function uploadSupportAttachment(file: File): Promise<UploadedAttachment> {
    const isImage = file.type.startsWith('image/');
    const botToken = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_TELEGRAM_BOT_TOKEN) 
        || DEFAULT_BOT_TOKEN;
    const channelId = (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_TELEGRAM_CHANNEL_ID || import.meta.env.VITE_TELEGRAM_CHAT_ID)) 
        || DEFAULT_CHANNEL_ID;

    if (!botToken || !channelId) {
        throw new Error("Telegram bot token or channel ID is not configured.");
    }

    // Direct Telegram Storage: upload file directly to Telegram server
    const formData = new FormData();
    formData.append('chat_id', channelId);
    
    const endpoint = isImage ? 'sendPhoto' : 'sendDocument';
    formData.append(isImage ? 'photo' : 'document', file);

    const response = await fetch(`https://api.telegram.org/bot${botToken}/${endpoint}`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Telegram upload failed (${response.status}): ${errorText || 'Server error'}`);
    }

    const data = await response.json();
    if (!data.ok || !data.result) {
        throw new Error(data.description || "Failed to process attachment on Telegram");
    }

    let fileId = '';
    if (isImage && Array.isArray(data.result.photo) && data.result.photo.length > 0) {
        fileId = data.result.photo[data.result.photo.length - 1].file_id;
    } else if (data.result.document && data.result.document.file_id) {
        fileId = data.result.document.file_id;
    }

    if (!fileId) {
        throw new Error("No Telegram file identifier was returned");
    }

    const messageId = data.result.message_id;
    const resultChatId = data.result.chat?.id || channelId;

    // Return the Telegram URL reference with message metadata for future deletion
    const tgUrl = messageId 
        ? `tg://${fileId}?msg_id=${messageId}&chat_id=${resultChatId}`
        : `tg://${fileId}`;

    return {
        attachment_url: tgUrl,
        attachment_name: file.name,
        attachment_type: file.type || (isImage ? 'image/jpeg' : 'application/octet-stream')
    };
}

/**
 * Delete a single attachment from Telegram channel/chat using stored message ID
 */
export async function deleteTelegramAttachment(attachmentUrl: string): Promise<boolean> {
    try {
        if (!attachmentUrl || !attachmentUrl.startsWith('tg://')) return false;

        const botToken = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_TELEGRAM_BOT_TOKEN) 
            || DEFAULT_BOT_TOKEN;
        const defaultChannelId = (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_TELEGRAM_CHANNEL_ID || import.meta.env.VITE_TELEGRAM_CHAT_ID)) 
            || DEFAULT_CHANNEL_ID;

        const queryString = attachmentUrl.includes('?') ? attachmentUrl.split('?')[1] : '';
        const urlParams = new URLSearchParams(queryString);
        const msgId = urlParams.get('msg_id');
        const chatId = urlParams.get('chat_id') || defaultChannelId;

        if (!msgId || !chatId || !botToken) return false;

        const res = await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: Number(msgId)
            })
        });

        const data = await res.json();
        return data.ok === true;
    } catch (err) {
        console.error("Error deleting Telegram attachment:", err);
        return false;
    }
}

/**
 * Batch delete all Telegram attachments associated with a set of attachment URLs
 */
export async function deleteTelegramAttachments(attachmentUrls: (string | undefined | null)[]): Promise<void> {
    const validUrls: string[] = [];
    
    for (const urlGroup of attachmentUrls) {
        if (!urlGroup) continue;
        const urls = urlGroup.split(',').map(u => u.trim()).filter(Boolean);
        for (const u of urls) {
            if (u.startsWith('tg://')) {
                validUrls.push(u);
            }
        }
    }

    if (validUrls.length === 0) return;

    await Promise.allSettled(validUrls.map(u => deleteTelegramAttachment(u)));
}
