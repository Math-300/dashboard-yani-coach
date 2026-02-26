// Vercel API Route - Agregados de métricas (reduce requests)
// Ruta: /api/metrics/summary?start=YYYY-MM-DD&end=YYYY-MM-DD

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

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

const isAuthenticated = (request: VercelRequest) => {
    const secret = getSecret();
    if (!secret) return false;

    const cookies = parseCookies(request.headers.cookie);
    const token = cookies[COOKIE_NAME];
    if (!token) return false;

    return !!verifyToken(token, secret);
};

const NOCODB_URL = process.env.NOCODB_URL || 'https://app.nocodb.com';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN;

const TABLES: Record<string, string> = {
    sellers: process.env.TABLE_SELLERS || 'me6kwgo0qvg0aug',
    contacts: process.env.TABLE_CONTACTS || 'mrwhtwissgz1xzr',
    interactions: process.env.TABLE_INTERACTIONS || 'm6gx25reozjbbt3',
    sales: process.env.TABLE_SALES || 'mm9p02mlk0i5ysy',
    attempts: process.env.TABLE_ATTEMPTS || 'mqdlglkwjvvtplc'
};

const MAX_CONCURRENT_REQUESTS = 1;
const MIN_REQUEST_INTERVAL_MS = 350;
const CACHE_TTL_MS = 60 * 1000; // 60s

type CacheEntry = { expiresAt: number; payload: any };
const responseCache = new Map<string, CacheEntry>();

type QueueItem<T> = {
    fn: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: any) => void;
};

let activeRequests = 0;
let lastRequestAt = 0;
const requestQueue: QueueItem<any>[] = [];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const runQueue = async () => {
    if (activeRequests >= MAX_CONCURRENT_REQUESTS) return;
    const item = requestQueue.shift();
    if (!item) return;

    activeRequests += 1;
    const waitMs = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (waitMs > 0) {
        await sleep(waitMs);
    }
    lastRequestAt = Date.now();

    try {
        const result = await item.fn();
        item.resolve(result);
    } catch (error) {
        item.reject(error);
    } finally {
        activeRequests -= 1;
        if (requestQueue.length > 0) {
            runQueue();
        }
    }
};

const scheduleRequest = async <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
        requestQueue.push({ fn, resolve, reject });
        runQueue();
    });
};

const fetchWithRetry = async (url: string, headers: Record<string, string>) => {
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const response = await scheduleRequest(() => fetch(url, { headers }));
        if (response.status === 429) {
            const waitMs = Math.pow(2, attempt) * 1000 + 700;
            console.warn(`[API] 429 desde NocoDB, reintentando en ${waitMs}ms (intento ${attempt + 1}/${MAX_RETRIES})`);
            await sleep(waitMs);
            continue;
        }
        return response;
    }
    return null;
};

const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const buildDateWhere = (dateField: string, start?: string, end?: string): string | undefined => {
    if (!start || !end) return undefined;
    return `(${dateField},gte,exactDate,${start})~and(${dateField},lte,exactDate,${end})`;
};

const fetchCount = async (tableId: string, where?: string): Promise<number> => {
    const params = `limit=1${where ? `&where=${encodeURIComponent(where)}` : ''}`;
    const url = `${NOCODB_URL}/api/v2/tables/${tableId}/records?${params}`;
    const res = await fetchWithRetry(url, {
        'xc-token': NOCODB_TOKEN || '',
        'Content-Type': 'application/json'
    });

    if (!res || !res.ok) return 0;
    const json = await res.json();
    return json.pageInfo?.totalRows ?? json.list?.length ?? 0;
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Content-Type', 'application/json');

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Método no permitido' });
    }

    if (!isAuthenticated(request)) {
        return response.status(401).json({ error: 'No autorizado' });
    }

    if (!NOCODB_TOKEN) {
        return response.status(500).json({
            error: 'Token API no configurado en el servidor',
            hint: 'Agrega NOCODB_TOKEN en las variables de entorno de Vercel'
        });
    }

    const start = typeof request.query.start === 'string' ? request.query.start : undefined;
    const end = typeof request.query.end === 'string' ? request.query.end : undefined;
    const cacheKey = `summary:${start || 'na'}:${end || 'na'}`;
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return response.status(200).json(cached.payload);
    }

    const startDate = start ? start : formatDate(new Date());
    const endDate = end ? end : formatDate(new Date());

    const createdWhere = buildDateWhere('Fecha y hora de creación', startDate, endDate);
    const interactionsWhere = buildDateWhere('Fecha', startDate, endDate);
    const salesWhere = buildDateWhere('Fecha', startDate, endDate);

    const funnelStatuses = [
        'Lead Nuevo',
        'En Seguimiento 24 hs después primer contacto',
        'En Seguimiento 7 días',
        'Llamada Agendada',
        'Seguimiento Cliente Nuevo',
        'Seguimiento venta perdida',
        'Seguimiento leads sin respuesta',
        'Seguimiento Potencial venta',
        'Contactar en 48 horas',
        'Nutrición a Largo Plazo',
        'No se presentó',
        'Venta Ganada',
        'Venta Perdida',
        'Leads perdidos (que nunca contestaron)',
        'no contactar'
    ];

    const funnelCounts: Record<string, number> = {};
    for (const status of funnelStatuses) {
        funnelCounts[status] = await fetchCount(TABLES.contacts, `(Estado Actual,eq,${status})`);
    }

    const interactionChannels = ['WhatsApp', 'Llamada', 'Email', 'System.io'];
    const interactionCounts: Record<string, number> = {};
    interactionCounts.total = await fetchCount(TABLES.interactions, interactionsWhere);
    for (const channel of interactionChannels) {
        const channelWhere = `(Medio/Canal,eq,${channel})`;
        const fullWhere = interactionsWhere ? `${interactionsWhere}~and${channelWhere}` : channelWhere;
        interactionCounts[channel] = await fetchCount(TABLES.interactions, fullWhere);
    }
    const knownTotal = interactionChannels.reduce((sum, ch) => sum + (interactionCounts[ch] || 0), 0);
    interactionCounts.Otro = Math.max(0, (interactionCounts.total || 0) - knownTotal);

    const kpiCounts = {
        leadsCreated: await fetchCount(TABLES.contacts, createdWhere),
        newLeads: await fetchCount(TABLES.contacts, createdWhere ? `${createdWhere}~and(Estado Actual,eq,Lead Nuevo)` : `(Estado Actual,eq,Lead Nuevo)`),
        urgentFollowUps: await fetchCount(TABLES.contacts, createdWhere ? `(Próximo Contacto,eq,today)~and${createdWhere}` : `(Próximo Contacto,eq,today)`),
        salesCount: await fetchCount(TABLES.sales, salesWhere)
    };

    const payload = {
        funnelCounts,
        interactionCounts,
        kpiCounts
    };

    responseCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    return response.status(200).json(payload);
}
