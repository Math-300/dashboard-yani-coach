// Vercel API Route - Proxy para NocoDB
// Este archivo va en la carpeta /api de tu proyecto Vercel

import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

// Configuración desde variables de entorno de Vercel
const NOCODB_URL = process.env.NOCODB_URL || 'https://app.nocodb.com';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN;

// IDs de las tablas
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
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    // Validar método
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Método no permitido' });
    }

    // Obtener el nombre de la tabla de la URL
    const { table } = request.query;

    if (!table || typeof table !== 'string') {
        return response.status(400).json({
            error: 'Tabla requerida',
            tablas: Object.keys(TABLES)
        });
    }

    const tableId = TABLES[table];

    if (!tableId) {
        return response.status(400).json({
            error: 'Tabla no válida',
            tablas: Object.keys(TABLES)
        });
    }

    if (!NOCODB_TOKEN) {
        return response.status(500).json({ error: 'Token API no configurado en el servidor' });
    }

    try {
        const url = `${NOCODB_URL}/api/v2/tables/${tableId}/records?limit=1000`;

        const nocoResponse = await fetch(url, {
            headers: {
                'xc-token': NOCODB_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        if (!nocoResponse.ok) {
            return response.status(nocoResponse.status).json({
                error: `Error de NocoDB: ${nocoResponse.status}`
            });
        }

        const data = await nocoResponse.json();
        return response.status(200).json(data);

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        return response.status(500).json({ error: message });
    }
}
