import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

type ChatMessage = {
    role: ChatRole;
    content: string;
    name?: string;
    tool_call_id?: string;
    tool_calls?: ToolCall[];
};

type ToolCall = {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
};

type OpenAiResponse = {
    choices?: Array<{
        message?: {
            role?: ChatRole;
            content?: string;
            tool_calls?: ToolCall[];
        };
    }>;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
    error?: {
        message?: string;
        type?: string;
    };
};

const COOKIE_NAME = 'yd_auth';

const getSecret = () => process.env.AUTH_SECRET || '';

const base64Url = (input: Buffer | string) => {
    const buffer = typeof input === 'string' ? Buffer.from(input) : input;
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
};

const sign = (payload: string, secret: string) => {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return base64Url(hmac.digest());
};

const parseCookies = (cookieHeader?: string) => {
    const cookies: Record<string, string> = {};
    if (!cookieHeader) return cookies;
    cookieHeader.split(';').forEach((part) => {
        const [name, ...rest] = part.trim().split('=');
        cookies[name] = rest.join('=');
    });
    return cookies;
};

const verifyToken = (token: string, secret: string) => {
    const [payloadEncoded, signature] = token.split('.');
    if (!payloadEncoded || !signature) return null;
    const expected = sign(payloadEncoded, secret);
    if (signature !== expected) return null;
    try {
        const json = Buffer.from(payloadEncoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
        return JSON.parse(json);
    } catch {
        return null;
    }
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

const NOCODB_URL = process.env.NOCODB_URL || 'https://app.nocodb.com';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN;

const TABLES: Record<string, string> = {
    sellers: process.env.TABLE_SELLERS || 'me6kwgo0qvg0aug',
    contacts: process.env.TABLE_CONTACTS || 'mrwhtwissgz1xzr',
    interactions: process.env.TABLE_INTERACTIONS || 'm6gx25reozjbbt3',
    sales: process.env.TABLE_SALES || 'mm9p02mlk0i5ysy',
    attempts: process.env.TABLE_ATTEMPTS || 'mqdlglkwjvvtplc'
};

const systemPrompt = `Eres “Asistente Yani”, asistente interno del dashboard de ventas y coaching.\n\nReglas:\n- Responde en español de forma clara, breve y accionable.\n- Tienes acceso a datos frescos mediante la herramienta nocodb_query. Úsala SIEMPRE que la pregunta requiera cifras o listados.\n- No inventes métricas ni cifras; si faltan datos, indícalo.\n\nObligatorio:\n- Antes de responder cualquier pregunta con cifras, listados, conteos o métricas, debes invocar nocodb_query.\n\nGuía rápida de consulta:\n- Ventas de hoy: nocodb_query(table: "sales", where: "(Fecha,eq,today)")\n- Contactos creados hoy: nocodb_query(table: "contacts", where: "(Fecha y hora de creación,eq,today)")\n- Interacciones hoy: nocodb_query(table: "interactions", where: "(Fecha,eq,today)")\n- Intentos de compra hoy: nocodb_query(table: "attempts", where: "(Fecha del Intento,eq,today)")\n\nTablas disponibles: sellers, contacts, interactions, sales, attempts.`;

const createChatCompletion = async (payload: Record<string, unknown>) => {
    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY no configurado');
    }

    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI error ${response.status}: ${errorText.slice(0, 200)}`);
    }

    return (await response.json()) as OpenAiResponse;
};

const parseToolArgs = (rawArgs?: string) => {
    if (!rawArgs) return null;
    try {
        return JSON.parse(rawArgs) as Record<string, unknown>;
    } catch {
        return null;
    }
};

const fetchNocoRecords = async (args: {
    table: string;
    limit?: number;
    offset?: number;
    where?: string;
    fields?: string;
}) => {
    if (!NOCODB_TOKEN) {
        throw new Error('NOCODB_TOKEN no configurado');
    }

    const tableId = TABLES[args.table];
    if (!tableId) {
        throw new Error(`Tabla no válida: ${args.table}`);
    }

    const limit = typeof args.limit === 'number' ? args.limit : 100;
    const offset = typeof args.offset === 'number' ? args.offset : 0;

    const url = new URL(`${NOCODB_URL}/api/v2/tables/${tableId}/records`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    if (args.where) {
        url.searchParams.set('where', args.where);
    }
    if (args.fields) {
        url.searchParams.set('fields', args.fields);
    }

    const response = await fetch(url.toString(), {
        headers: {
            'xc-token': NOCODB_TOKEN,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`NocoDB error ${response.status}: ${text.slice(0, 200)}`);
    }

    return response.json();
};

const isAuthenticated = (request: VercelRequest) => {
    const secret = getSecret();
    if (!secret) return false;

    const cookies = parseCookies(request.headers.cookie);
    const token = cookies[COOKIE_NAME];
    if (!token) return false;

    return !!verifyToken(token, secret);
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
    response.setHeader('Content-Type', 'application/json');

    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Método no permitido' });
    }

    if (!isAuthenticated(request)) {
        return response.status(401).json({ error: 'No autorizado' });
    }

    const secret = getSecret();
    if (!secret) {
        return response.status(500).json({ error: 'AUTH_SECRET no configurado' });
    }

    try {
        const { messages } = request.body || {};

        if (!Array.isArray(messages) || messages.length === 0) {
            return response.status(400).json({ error: 'messages es requerido' });
        }

        const tools = [
            {
                type: 'function',
                function: {
                    name: 'nocodb_query',
                    description: 'Consulta registros de NocoDB usando tablas configuradas en el backend.',
                    parameters: {
                        type: 'object',
                        properties: {
                            table: {
                                type: 'string',
                                enum: Object.keys(TABLES)
                            },
                            limit: { type: 'number' },
                            offset: { type: 'number' },
                            where: { type: 'string' },
                            fields: { type: 'string' }
                        },
                        required: ['table']
                    }
                }
            }
        ];

        const conversation: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...messages
        ];

        const firstResponse = await createChatCompletion({
            model: OPENAI_MODEL,
            messages: conversation,
            tools,
            tool_choice: 'auto',
            temperature: 0.2
        });

        const firstMessage = firstResponse.choices?.[0]?.message;
        const toolCalls = firstMessage?.tool_calls || [];

        if (toolCalls.length > 0) {
            const toolResults: ChatMessage[] = [];

            for (const call of toolCalls) {
                if (call.function?.name !== 'nocodb_query') {
                    toolResults.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: JSON.stringify({
                            ok: false,
                            error: `Herramienta no soportada: ${call.function?.name || 'desconocida'}`
                        })
                    });
                    continue;
                }

                const parsedArgs = parseToolArgs(call.function.arguments);
                const table = typeof parsedArgs?.table === 'string' ? parsedArgs.table : '';
                const args: { table: string; limit?: number; offset?: number; where?: string; fields?: string } = {
                    table,
                    limit: typeof parsedArgs?.limit === 'number' ? parsedArgs.limit : undefined,
                    offset: typeof parsedArgs?.offset === 'number' ? parsedArgs.offset : undefined,
                    where: typeof parsedArgs?.where === 'string' ? parsedArgs.where : undefined,
                    fields: typeof parsedArgs?.fields === 'string' ? parsedArgs.fields : undefined
                };

                if (!args.table) {
                    toolResults.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: JSON.stringify({ ok: false, error: 'Argumentos inválidos para nocodb_query' })
                    });
                    continue;
                }

                try {
                    const data = await fetchNocoRecords(args);
                    toolResults.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: JSON.stringify({ ok: true, data })
                    });
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Error desconocido';
                    toolResults.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: JSON.stringify({ ok: false, error: message })
                    });
                }
            }

            const assistantToolMessage: ChatMessage = {
                role: 'assistant',
                content: firstMessage?.content || '',
                tool_calls: toolCalls
            } as ChatMessage;

            const finalResponse = await createChatCompletion({
                model: OPENAI_MODEL,
                messages: [...conversation, assistantToolMessage, ...toolResults],
                temperature: 0.2
            });

            const finalMessage = finalResponse.choices?.[0]?.message?.content || '';
            return response.status(200).json({
                reply: finalMessage,
                model: OPENAI_MODEL,
                usage: finalResponse.usage
            });
        }

        return response.status(200).json({
            reply: firstMessage?.content || '',
            model: OPENAI_MODEL,
            usage: firstResponse.usage
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        return response.status(500).json({ error: 'Error en el servidor', details: message });
    }
}
