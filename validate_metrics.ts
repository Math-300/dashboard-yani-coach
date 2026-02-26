import fetch from 'node-fetch';
import { TABLE_IDS } from './config';

const NOCODB_URL = 'https://app.nocodb.com';
const NOCODB_TOKEN = 'KmEce4G0VLt9WJdkt4p0LEL6qm0jWUb3sHcI3tNW';

interface DateRange {
    start: Date;
    end: Date;
}

const DATE_FIELD_MAP: Record<string, string> = {
    contacts: 'Fecha y hora de creación',
    interactions: 'Fecha',
    sales: 'Fecha',
    attempts: 'Fecha del Intento',
    sellers: ''
};

const ENDPOINT_TO_TABLE: Record<string, string> = {
    sellers: TABLE_IDS.sellers,
    contacts: TABLE_IDS.contacts,
    interactions: TABLE_IDS.interactions,
    sales: TABLE_IDS.sales,
    attempts: TABLE_IDS.attempts
};

const getSortParam = (endpoint: string): string => {
    switch (endpoint) {
        case 'contacts':
            return '&sort=-Fecha%20y%20hora%20de%20creación';
        case 'interactions':
        case 'sales':
            return '&sort=-Fecha';
        default:
            return '';
    }
};

const buildWhereClause = (dateRange: { start?: Date, end?: Date } | null, endpoint: string): string | null => {
    if (!dateRange || !dateRange.start || !dateRange.end) return null;
    const dateField = DATE_FIELD_MAP[endpoint];
    if (!dateField) return null;
    if (endpoint === 'contacts') {
        const startIso = dateRange.start.toISOString();
        const endIso = dateRange.end.toISOString();
        return `(${dateField},gte,${startIso})~and(${dateField},lte,${endIso})`;
    } else {
        const formatDateLocal = (date: Date): string => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        const startStr = formatDateLocal(dateRange.start);
        const endStr = formatDateLocal(dateRange.end);
        return `(${dateField},gte,exactDate,${startStr})~and(${dateField},lte,exactDate,${endStr})`;
    }
};

async function fetchRecords(endpoint: string, dateRange?: DateRange | null) {
    const tableId = ENDPOINT_TO_TABLE[endpoint];
    const limit = 1000;
    const whereClause = buildWhereClause(dateRange || null, endpoint);
    const whereParam = whereClause ? `&where=${encodeURIComponent(whereClause)}` : '';
    const url = `${NOCODB_URL}/api/v2/tables/${tableId}/records?limit=${limit}&offset=0${getSortParam(endpoint)}${whereParam}`;

    console.log(`[API REQUEST] ${url}`);
    const response = await fetch(url, {
        headers: {
            'xc-token': NOCODB_TOKEN,
            'Content-Type': 'application/json'
        }
    });
    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
    const json = await response.json();
    return json.list || [];
}

async function validateDashboardMetrics() {
    console.log("=== INICIANDO VALIDACIÓN DE METRICAS ===");

    // Definir rangos:
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const sevenDaysStart = new Date(todayStart);
    sevenDaysStart.setDate(todayStart.getDate() - 6);

    const oneMonthStart = new Date(todayStart);
    oneMonthStart.setDate(todayStart.getDate() - 29);

    const sixMonthsStart = new Date(todayStart);
    sixMonthsStart.setDate(todayStart.getDate() - 179);

    const ranges = [
        { label: "1 Día (Hoy)", range: { start: todayStart, end: todayEnd } },
        { label: "7 Días", range: { start: sevenDaysStart, end: todayEnd } },
        { label: "1 Mes", range: { start: oneMonthStart, end: todayEnd } },
        { label: "6 Meses", range: { start: sixMonthsStart, end: todayEnd } },
    ];

    console.log(`Fecha Actual Local: ${now.toString()}`);
    console.log(`Fecha Actual UTC: ${now.toISOString()}`);

    for (const r of ranges) {
        console.log(`\n\n=== Validando rango: ${r.label} ===`);
        console.log(`Local Range: ${r.range.start.toLocaleString()} -> ${r.range.end.toLocaleString()}`);

        let contactsFiltered: any[] = [];
        let interactionsFiltered: any[] = [];
        let salesFiltered: any[] = [];
        try { contactsFiltered = await fetchRecords('contacts', r.range); } catch (e: any) { console.error("Contacts API error:", e.message) }
        try { interactionsFiltered = await fetchRecords('interactions', r.range); } catch (e: any) { console.error("Interactions API error:", e.message) }
        try { salesFiltered = await fetchRecords('sales', r.range); } catch (e: any) { console.error("Sales API error:", e.message) }

        console.log(`>> Datos VÍA NocoDB 'exactDate' (lo que recibe el Dashboard):`);
        console.log(`   - Contacts: ${contactsFiltered.length}`);
        console.log(`   - Interactions: ${interactionsFiltered.length}`);
        console.log(`   - Sales: ${salesFiltered.length}`);

        // Ahora comprobamos TODA la base de datos simulando el filtro UTC vs LOCAL idealmente.
        const allContacts = await fetchRecords('contacts', null); // 1000 limit should be enough for testing recently
        const allInteractions = await fetchRecords('interactions', null);
        const allSales = await fetchRecords('sales', null);

        const normalizeDate = (date: any): string => {
            if (!date) return new Date(0).toISOString();
            if (typeof date === 'string') {
                if (!date.endsWith('Z') && !date.includes('+') && !date.includes('T')) {
                    return new Date(date + 'T00:00:00Z').toISOString();
                } else if (!date.endsWith('Z') && !date.includes('+') && date.includes('T')) {
                    return new Date(date + 'Z').toISOString(); // NocoDB sin Z
                }
            }
            return new Date(date).toISOString();
        };

        const filterLocal = (list: any[], dateField: string, range: DateRange) => {
            return list.filter(item => {
                const dateISO = normalizeDate(item[dateField] || item.created_at || item.CreatedAt);
                const dateTime = new Date(dateISO).getTime();
                return dateTime >= range.start.getTime() && dateTime <= range.end.getTime();
            });
        };

        const memContacts = filterLocal(allContacts, 'Fecha y hora de creación', r.range);
        const memInteractions = filterLocal(allInteractions, 'Fecha', r.range);
        const memSales = filterLocal(allSales, 'Fecha', r.range);

        console.log(`>> Datos REALES filtrados en memoria usando JS Local Timezone:`);
        console.log(`   - Contacts: ${memContacts.length}`);
        console.log(`   - Interactions: ${memInteractions.length}`);
        console.log(`   - Sales: ${memSales.length}`);

        if (contactsFiltered.length !== memContacts.length) {
            console.log("   ❌ DISCREPANCIA EN CONTACTOS (Timezone Bug NocoDB exactDate)");
            // Encontrar cuales faltan
            const setFiltered = new Set(contactsFiltered.map((x: any) => x.Id));
            const missing = memContacts.filter(x => !setFiltered.has(x.Id));
            console.log(`     - Faltan o sobran IDs: ${missing.map(x => `${x.Id} [${x.Nombre} - ${x['Fecha y hora de creación']}]`).join(', ')}`);
        } else {
            console.log("   ✅ CONTACTOS MATCH");
        }

        if (salesFiltered.length !== memSales.length) {
            console.log("   ❌ DISCREPANCIA EN VENTAS (Timezone Bug NocoDB exactDate)");
        } else {
            console.log("   ✅ VENTAS MATCH");
        }
    }
}

validateDashboardMetrics().catch(console.error);
