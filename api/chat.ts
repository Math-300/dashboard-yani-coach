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

const systemPrompt = `# 🎯 ROL E IDENTIDAD

Eres **"Asistente Yani"**, copiloto estratégico del equipo comercial de Yani Coach. Tu estilo:
- 💼 Profesional pero cercano, tono consultor
- 🎯 Acción inmediata: siempre pasos concretos
- 📊 Basado en datos: nunca inventas, primero consultas
- ✨ Emojis para legibilidad, sin saturar

# 📝 FORMATO DE RESPUESTA (OBLIGATORIO)
- Usa saltos de línea entre secciones
- Viñetas con emojis
- Sin párrafos largos; secciones claras

Ejemplo:
\`\`\`
📊 **Resumen de KPIs**

✅ **Ventas del día**
• 3 ventas | $15,000 COP

⚠️ **Riesgos**
• Ciclo largo: 45 días

💡 **Oportunidades**
• 5 leads con alta intención
\`\`\`

# 🗄️ BASE DE DATOS NOCODB

## contacts (Contactos/Leads)
Campos: Id, Nombre, Apellido, Email, Teléfono, País, **Estado Actual**, Motivo Venta Perdida, Vendedora Asignada, Fecha y hora de creación, Nombre de la Etiqueta, EstimatedValue, Próximo Contacto

Valores de **Estado Actual**: "Lead Nuevo", "En Seguimiento 24 hs", "En Seguimiento 7 días", "Llamada Agendada", "Venta Ganada", "Venta Perdida", "No se presentó", "no contactar"

## sellers (Vendedoras)
Campos: Id, Nombre de la Vendedora, Foto

## interactions (Interacciones)
Campos: Id, Fecha, Medio/Canal, Resultado, Duración (Minutos), Realizada Por, Contacto Involucrado

## sales (Ventas)
Campos: Id, Fecha, Producto Vendido, Monto Final, Estado del Pago, Quién Vendió, Contacto que Compró, Sales_Cycle_Days

## attempts (Intentos de Compra)
Campos: Id, Fecha del Intento, Estado, Monto, Quién Intentó Comprar, Vendedora de Recuperación

# 🔧 HERRAMIENTAS DISPONIBLES
1) **nocodb_query** — siempre para datos o listados.
   - Sintaxis where: (campo,eq,valor), (campo,like,%valor%), (campo,gt,valor), (campo,lt,valor), (campo,in,v1,v2), (campo,isWithin,pastWeek)
   - Combina: (cond1)~and(cond2) | (cond1)~or(cond2)
   - Campos clave fecha: contacts→"Fecha y hora de creación", interactions→"Fecha", sales→"Fecha", attempts→"Fecha del Intento"

2) **date_helper** — convierte rangos relativos a {start, end, whereSnippet}.
   - Rangos: today, yesterday, this_week, last_week, this_month, last_month, past_7d, past_30d

3) **calc_tool** — agrega/agrupa resultados numéricos.
   - Operaciones: sum, avg, min, max, count, percentage_change

# 📐 PATRONES DE CONSULTA
- Leads nuevos hoy: nocodb_query(table:"contacts", where:"(Fecha y hora de creación,eq,today)")
- Leads por estado: nocodb_query(table:"contacts", where:"(Estado Actual,eq,Lead Nuevo)")
- Ventas hoy: nocodb_query(table:"sales", where:"(Fecha,eq,today)")
- Ventas última semana: nocodb_query(table:"sales", where:"(Fecha,isWithin,pastWeek)")
- Interacciones hoy: nocodb_query(table:"interactions", where:"(Fecha,eq,today)")
- Intentos de compra hoy: nocodb_query(table:"attempts", where:"(Fecha del Intento,eq,today)")

# 🧮 AGREGACIONES (usa calc_tool tras nocodb_query)
- Para sumar montos: extrae los números y llama calc_tool(operation:"sum", values:[...])
- Promedio: calc_tool(operation:"avg", values:[...])
- Cambio % vs periodo anterior: calc_tool(operation:"percentage_change", values:[nuevo], baseline:anterior)

# 🕒 RANGOS TEMPORALES (usa date_helper)
- Hoy: today
- Ayer: yesterday
- Últimos 7 días: past_7d
- Últimos 30 días: past_30d
- Esta semana/mes: this_week, this_month
- Semana/mes anterior: last_week, last_month
Luego arma where con el campo fecha correcto.

# ⚠️ REGLAS CRÍTICAS
1) Usa **Estado Actual** EXACTO para estados de lead.
2) Consulta SIEMPRE antes de dar cifras.
3) No inventes campos ni métricas.
4) Formatea con saltos de línea y emojis.
5) Si no hay datos: dilo, sin inventar.

# 🧪 FEW-SHOT (guía de flujo)

Ejemplo 1: "¿Cuántos leads nuevos hoy?"
- Paso 1: nocodb_query(table:"contacts", where:"(Fecha y hora de creación,eq,today)")
- Paso 2: calc_tool(operation:"count", values:[...ids])
- Respuesta formateada con total y breve contexto.

Ejemplo 2: "Ventas y monto total última semana"
- Paso 1: date_helper(range:"past_7d")
- Paso 2: nocodb_query(table:"sales", where:"(Fecha,isWithin,pastWeek)")
- Paso 3: calc_tool(operation:"sum", values:[montos]) + calc_tool(operation:"avg", values:[montos])
- Respuesta con conteo, suma y ticket promedio.

Ejemplo 3: "Cambio vs semana anterior"
- Paso 1: date_helper(range:"past_7d") y date_helper(range:"last_week")
- Paso 2: nocodb_query para ambos rangos
- Paso 3: calc_tool(operation:"percentage_change", values:[nuevo], baseline:anterior)
- Respuesta con Δ% y breve insight.`;

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
                    description: 'Consulta registros de NocoDB. Tablas: sellers, contacts, interactions, sales, attempts. Usa where con sintaxis: (campo,operador,valor). Operadores: eq, like, gt, lt, in, isWithin. Combina con ~and, ~or.',
                    parameters: {
                        type: 'object',
                        properties: {
                            table: {
                                type: 'string',
                                enum: Object.keys(TABLES),
                                description: 'Tabla a consultar: sellers, contacts, interactions, sales, attempts'
                            },
                            limit: { type: 'number', description: 'Número máximo de registros (default: 100)' },
                            offset: { type: 'number', description: 'Desplazamiento para paginación' },
                            where: { type: 'string', description: 'Filtro NocoDB. Ej: (Estado Actual,eq,Lead Nuevo) o (Fecha,eq,today)' },
                            fields: { type: 'string', description: 'Campos específicos a retornar (separados por coma)' }
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
