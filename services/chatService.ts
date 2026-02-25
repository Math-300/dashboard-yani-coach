export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
    role: ChatRole;
    content: string;
};

export type ChatResponse = {
    reply: string;
    model?: string;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
};

const JSON_HEADERS = {
    'Content-Type': 'application/json'
};

export async function sendChat(messages: ChatMessage[]): Promise<ChatResponse> {
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: JSON_HEADERS,
        credentials: 'include',
        body: JSON.stringify({ messages })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Error de chat' }));
        throw new Error(error.error || 'Error de chat');
    }

    return response.json();
}
