// Vercel API Route - Proxy para NocoDB
// Este archivo crea endpoints serverless que ocultan el token API
// Ruta: /api/nocodb/{sellers|contacts|interactions|sales|attempts}

import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    const tableName = Array.isArray(tableParam) ? tableParam[0] : tableParam;

    if (!tableName) {
        return response.status(400).json({
            error: 'Tabla no especificada',
            usage: '/api/nocodb/{sellers|contacts|interactions|sales|attempts}',
            availableTables: Object.keys(TABLES)
        });
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

        let url = `${NOCODB_URL}/api/v2/tables/${tableId}/records?limit=${limit}&offset=${offset}`;

        // Agregar campos específicos si se solicitan
        if (fields) {
            url += `&fields=${fields}`;
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
