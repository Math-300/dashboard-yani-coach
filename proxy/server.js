// Proxy Server para NocoDB
// Este servidor oculta el token API del navegador del cliente

import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

// Configuración desde variables de entorno
const NOCODB_URL = process.env.NOCODB_URL || 'https://app.nocodb.com';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN;

// IDs de las tablas
const TABLES = {
    sellers: process.env.TABLE_SELLERS || 'me6kwgo0qvg0aug',
    contacts: process.env.TABLE_CONTACTS || 'mrwhtwissgz1xzr',
    interactions: process.env.TABLE_INTERACTIONS || 'm6gx25reozjbbt3',
    sales: process.env.TABLE_SALES || 'mm9p02mlk0i5ysy',
    attempts: process.env.TABLE_ATTEMPTS || 'mqdlglkwjvvtplc'
};

// Middleware CORS - permitir solo tu dominio del dashboard
// Cambia 'YOUR_DASHBOARD_DOMAIN' por tu dominio real o usa '*' para desarrollo
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'];

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin || '*');
    }
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Logging de requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Endpoint genérico para obtener registros de cualquier tabla
app.get('/api/:table', async (req, res) => {
    const tableName = req.params.table;
    const tableId = TABLES[tableName];

    if (!tableId) {
        console.error(`Tabla no válida: ${tableName}`);
        return res.status(400).json({ error: 'Tabla no válida', tablas: Object.keys(TABLES) });
    }

    if (!NOCODB_TOKEN) {
        console.error('NOCODB_TOKEN no configurado');
        return res.status(500).json({ error: 'Token API no configurado en el servidor' });
    }

    try {
        const url = `${NOCODB_URL}/api/v2/tables/${tableId}/records?limit=1000`;

        const response = await fetch(url, {
            headers: {
                'xc-token': NOCODB_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`Error de NocoDB: ${response.status} ${response.statusText}`);
            return res.status(response.status).json({ error: `Error de NocoDB: ${response.status}` });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error(`Error fetching ${tableName}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint de información
app.get('/api', (req, res) => {
    res.json({
        message: 'NocoDB Proxy API',
        endpoints: Object.keys(TABLES).map(t => `/api/${t}`),
        tables: TABLES
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Proxy NocoDB ejecutándose en puerto ${PORT}`);
    console.log(`📋 Tablas disponibles:`, Object.keys(TABLES));
});
