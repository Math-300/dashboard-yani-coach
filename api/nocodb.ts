// Vercel API Route - Proxy para NocoDB
// Este archivo crea endpoints serverless que ocultan el token API

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

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    // Extraer el nombre de la tabla de la URL: /api/nocodb/sellers
    const pathParts = request.url?.split('/api/nocodb/') || [];
    const tableName = pathParts[1];

    if (!tableName) {
        return response.status(400).json({
            error: 'Tabla no especificada. Uso: /api/nocodb/{sellers|contacts|interactions|sales|attempts}'
        });
    }

    const tableId = TABLES[tableName];

    if (!tableId) {
        return response.status(400).json({
            error: 'Tabla no válida',
            tablas: Object.keys(TABLES)
        });
    }

    if (!NOCODB_TOKEN) {
        console.error('NOCODB_TOKEN no configurado en Vercel');
        return response.status(500).json({ error: 'Token API no configurado en el servidor' });
    }

    try {
        // Obtener parámetros de query
        const limit = request.query.limit || 1000;
        const offset = request.query.offset || 0;

        const url = `${NOCODB_URL}/api/v2/tables/${tableId}/records?limit=${limit}&offset=${offset}`;

        const nocoResponse = await fetch(url, {
            headers: {
                'xc-token': NOCODB_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        if (!nocoResponse.ok) {
            console.error(`Error de NocoDB: ${nocoResponse.status} ${nocoResponse.statusText}`);
            return response.status(nocoResponse.status).json({
                error: `Error de NocoDB: ${nocoResponse.status}`
            });
        }

        const data = await nocoResponse.json();

        // Responder con formato compatible con el frontend
        response.status(200).json({
            list: data.list || [],
            pageInfo: data.pageInfo
        });

    } catch (error) {
        console.error(`Error fetching ${tableName}:`, error);
        response.status(500).json({ error: error instanceof Error ? error.message : 'Error desconocido' });
    }
}
