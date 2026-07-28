/**
 * Auditoría de captura 100%: afirma que NINGÚN nodo en NINGÚN workflow va directo a NocoDB.
 * Viola si: (a) url/jsCode contiene app.nocodb.com, o (b) nodo nocoDb usa la credencial vieja OLD_CRED_ID.
 * Uso: N8N_KEY=... node audit-capture.mjs
 */
const N8N = process.env.N8N_URL || 'https://dev-n8n.yanicoach.us';
const KEY = process.env.N8N_KEY;
const OLD_CRED_ID = process.env.OLD_CRED_ID || '6XewvSZHl1RngLhP';
const h = { 'X-N8N-API-KEY': KEY, accept: 'application/json' };

const list = await (await fetch(`${N8N}/api/v1/workflows?limit=250`, { headers: h })).json();
const viol = [];
let checked = 0;
for (const w of list.data) {
  const wf = await (await fetch(`${N8N}/api/v1/workflows/${w.id}`, { headers: h })).json();
  checked++;
  for (const n of wf.nodes || []) {
    const t = String(n.type || '');
    const p = n.parameters || {};
    const act = wf.active ? 'ACTIVO' : 'inactivo';
    // PRECISO: solo campos que son target real de request a NocoDB
    if (t === 'n8n-nodes-base.httpRequest' && typeof p.url === 'string' && p.url.includes('app.nocodb.com'))
      viol.push(`[${act}] ${wf.name} (${w.id}) :: ${n.name} :: HTTP url app.nocodb.com`);
    if (/code/i.test(t) && /app\.nocodb\.com/.test(`${p.jsCode || ''}${p.pythonCode || ''}`))
      viol.push(`[${act}] ${wf.name} (${w.id}) :: ${n.name} :: Code-fetch app.nocodb.com`);
    if (t === 'n8n-nodes-base.nocoDb' && n.credentials?.nocoDbApiToken?.id === OLD_CRED_ID)
      viol.push(`[${act}] ${wf.name} (${w.id}) :: ${n.name} :: cred vieja`);
    // MCP client / langchain tools que puedan apuntar a NocoDB — marcar para revisión (no necesariamente violación)
    if (/mcp/i.test(t) && JSON.stringify(p).match(/nocodb|app\.nocodb/i))
      viol.push(`[${act}] ${wf.name} (${w.id}) :: ${n.name} :: ⚠️REVISAR MCP (${t})`);
  }
}
console.log(`Workflows auditados: ${checked}`);
if (!viol.length) console.log('✅ CAPTURA 100%: 0 nodos van directo a NocoDB. Todo pasa por el proxy.');
else { console.log(`❌ ${viol.length} violaciones (van directo a NocoDB):`); viol.forEach((v) => console.log('  -', v)); }
