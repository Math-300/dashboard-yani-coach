import fetch from 'node-fetch';
import { TABLE_IDS } from './config';

const NOCODB_URL = 'https://app.nocodb.com';
const NOCODB_TOKEN = 'KmEce4G0VLt9WJdkt4p0LEL6qm0jWUb3sHcI3tNW';

async function testQuery(whereClause: string) {
    const tableId = TABLE_IDS.contacts;
    const url = `${NOCODB_URL}/api/v2/tables/${tableId}/records?limit=5&offset=0&where=${encodeURIComponent(whereClause)}`;
    console.log(`[REQUEST] ${whereClause}`);
    const response = await fetch(url, { headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' } });
    if (!response.ok) {
        console.error(`ERROR: ${response.status} ${await response.text()}`);
        return;
    }
    const json = await response.json();
    console.log(`[RESULT] ${json.list?.length || 0} records.`);
    if (json.list?.length) {
        console.log(`First record date: ${json.list[0]['Fecha y hora de creación']}`);
    }
}

async function run() {
    console.log("Testing exactDate...");
    await testQuery("(Fecha y hora de creación,gte,exactDate,2026-02-25)");

    console.log("Fetching 1 contact to inspect columns...");
    const url = `https://app.nocodb.com/api/v2/tables/mrwhtwissgz1xzr/records?limit=1`;
    const response = await fetch(url, {
        headers: { 'xc-token': process.env.VITE_NOCODB_TOKEN || '' }
    });
    const json = await response.json();
    if (json.list && json.list.length > 0) {
        import('fs').then(fs => {
            fs.writeFileSync('columns_output.json', JSON.stringify(json.list[0], null, 2));
            console.log("Saved to columns_output.json");
        });
    }
}

run();
