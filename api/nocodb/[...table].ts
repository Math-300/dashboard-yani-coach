// Vercel API Route - Proxy para NocoDB
// Este archivo crea endpoints serverless que ocultan el token API
// Ruta: /api/nocodb/{sellers|contacts|interactions|sales|attempts}

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

// Configuración desde variables de entorno de Vercel
const NOCODB_URL = process.env.NOCODB_URL || 'https://app.nocodb.com';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN;

// IDs de las tablas (debes configurar estos en Vercel)
const TABLES: Record<string, string> = {
    sellers: process.env.TABLE_SELLERS || 'me6kwgo0qvg0aug',
    contacts: process.env.TABLE_CONTACTS || 'mrwhtwissgz1xzr',
    interactions: process.env.TABLE_INTERACTIONS || 'm6gx25reozjbbt3',
    sales: process.env.TABLE_SALES || 'mm9p02mlk0i5ysy',
    attempts: process.env.TABLE_ATTEMPTS || 'mqdlglkwjvvtplc'
};

export default async function handler(
    request: VercelRequest,
    response: VercelResponse
) {
    // Configurar CORS
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Content-Type', 'application/json');

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    if (request.method !== 'GET') {
        return response.status(405).json({
            error: 'Método no permitido',
            allowedMethods: ['GET', 'OPTIONS']
        });
    }

    // En Vercel, los parámetros de ruta catch-all están en query
    // La ruta /api/nocodb/sellers se mapea a table = ['sellers']
    const tableParam = request.query.table;
    let tableName = Array.isArray(tableParam) ? tableParam[0] : tableParam;

    // Fallback robusto: extraer desde la URL cuando query.table llega vacío
    if (!tableName && request.url) {
        try {
            const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
            const match = url.pathname.match(/\/api\/nocodb\/([^/]+)/i);
            if (match && match[1]) {
                tableName = match[1];
            }
        } catch (error) {
            console.warn('[API] No se pudo parsear la URL para tableName');
        }
    }

    if (!tableName) {
        return response.status(400).json({
            error: 'Tabla no especificada',
            usage: '/api/nocodb/{sellers|contacts|interactions|sales|attempts}',
            availableTables: Object.keys(TABLES)
        });
    }

    if (!isAuthenticated(request)) {
        return response.status(401).json({ error: 'No autorizado' });
    }

    const tableId = TABLES[tableName];

    if (!tableId) {
        return response.status(404).json({
            error: 'Tabla no válida',
            requestedTable: tableName,
            availableTables: Object.keys(TABLES)
        });
    }

    if (!NOCODB_TOKEN) {
        console.error('[API Error] NOCODB_TOKEN no configurado en Vercel');
        return response.status(500).json({
            error: 'Token API no configurado en el servidor',
            hint: 'Agrega NOCODB_TOKEN en las variables de entorno de Vercel'
        });
    }

    try {
        // Obtener parámetros de query
        const limit = request.query.limit || 1000;
        const offset = request.query.offset || 0;
        const fields = request.query.fields;
        const where = request.query.where;
        const sort = request.query.sort;

        let url = `${NOCODB_URL}/api/v2/tables/${tableId}/records?limit=${limit}&offset=${offset}`;

        // Agregar campos específicos si se solicitan
        if (fields) {
            url += `&fields=${fields}`;
        }

        if (where) {
            url += `&where=${where}`;
        }

        if (sort) {
            url += `&sort=${sort}`;
        }

        console.log(`[API] Fetching ${tableName} from NocoDB...`);

        const nocoResponse = await fetch(url, {
            headers: {
                'xc-token': NOCODB_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        if (!nocoResponse.ok) {
            const errorText = await nocoResponse.text();
            console.error(`[API Error] NocoDB respondió ${nocoResponse.status}: ${errorText.substring(0, 200)}`);

            return response.status(nocoResponse.status).json({
                error: `Error de NocoDB: ${nocoResponse.status} ${nocoResponse.statusText}`,
                table: tableName,
                hint: nocoResponse.status === 401
                    ? 'Verifica que NOCODB_TOKEN sea válido'
                    : nocoResponse.status === 404
                        ? 'Verifica que el ID de la tabla sea correcto'
                        : 'Error desconocido del servidor NocoDB'
            });
        }

        const data = await nocoResponse.json();

        console.log(`[API] Successfully fetched ${data.list?.length || 0} records from ${tableName}`);

        // Responder con formato compatible con el frontend
        response.status(200).json({
            list: data.list || [],
            pageInfo: data.pageInfo || {
                totalRows: data.list?.length || 0,
                page: 1,
                pageSize: 1000,
                isFirstPage: true,
                isLastPage: true
            }
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        console.error(`[API Error] Exception fetching ${tableName}:`, errorMessage);

        response.status(500).json({
            error: 'Error interno del servidor',
            details: errorMessage,
            table: tableName,
            timestamp: new Date().toISOString()
        });
    }
}
