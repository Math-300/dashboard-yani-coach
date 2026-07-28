/**
 * Migración reversible de host NocoDB → proxy, por workflow, vía API n8n.
 *
 * Uso:
 *   N8N_KEY=... node migrate-hosts.mjs <workflowId>            # DRY-RUN (default): solo muestra el diff
 *   N8N_KEY=... node migrate-hosts.mjs <workflowId> --apply    # aplica (con backup + toggle)
 *   N8N_KEY=... node migrate-hosts.mjs <workflowId> --revert <backup.json>   # restaura backup
 *
 * Solo cambia el HOST dentro de node.parameters (url/jsCode/headers). NO toca auth, lógica ni conexiones.
 * Reemplaza https://app.nocodb.com y http://app.nocodb.com → PROXY (env PROXY_BASE).
 */
import fs from 'node:fs';

const N8N = process.env.N8N_URL || 'https://dev-n8n.yanicoach.us';
const KEY = process.env.N8N_KEY;
const PROXY = process.env.PROXY_BASE || 'http://yani_nocodb_proxy:8090';
const FROM = /https?:\/\/app\.nocodb\.com/g;
const OLD_CRED_ID = process.env.OLD_CRED_ID || '6XewvSZHl1RngLhP'; // 'Nocodb Yani' (host app.nocodb.com)
const PROXY_CRED_ID = process.env.PROXY_CRED_ID || ''; // credencial 'Nocodb Yani (via proxy)' — si se setea, repunta nativos
const PROXY_CRED_NAME = process.env.PROXY_CRED_NAME || 'Nocodb Yani (via proxy)';

const wfId = process.argv[2];
const apply = process.argv.includes('--apply');
const revertIdx = process.argv.indexOf('--revert');

if (!KEY || !wfId) { console.error('Falta N8N_KEY o workflowId'); process.exit(1); }
const h = { 'X-N8N-API-KEY': KEY, 'content-type': 'application/json', accept: 'application/json' };

async function getWf(id) {
  const r = await fetch(`${N8N}/api/v1/workflows/${id}`, { headers: h });
  if (!r.ok) throw new Error(`GET ${id}: ${r.status}`);
  return r.json();
}

// PRECISO por tipo: solo reescribe campos que son TARGET de request.
//  - httpRequest → solo parameters.url
//  - *code*      → solo parameters.jsCode (llamadas API dentro de Code)
// Nunca toca cuerpos de email, labels, ni otros campos (evita falsos positivos como el link
// a la ficha NocoDB dentro del correo Gmail "Enviar Correo Asesora").
function transform(wf) {
  let count = 0; const hits = []; let credCount = 0; const credHits = [];
  const nodes = wf.nodes.map((n) => {
    // Swap de credencial en nodos nativos nocoDb: OLD_CRED_ID → PROXY_CRED_ID
    let nn = n;
    if (PROXY_CRED_ID && String(n.type) === 'n8n-nodes-base.nocoDb'
        && n.credentials?.nocoDbApiToken?.id === OLD_CRED_ID) {
      nn = { ...n, credentials: { ...n.credentials, nocoDbApiToken: { id: PROXY_CRED_ID, name: PROXY_CRED_NAME } } };
      credCount++; credHits.push(`${n.name} [nocoDb cred]`);
    }
    n = nn;
    if (!n.parameters) return n;
    const t = String(n.type || '');
    const fields = t === 'n8n-nodes-base.httpRequest' ? ['url']
      : /\.code$/i.test(t) || /code/i.test(t) ? ['jsCode', 'pythonCode']
      : [];
    if (!fields.length) return n;
    let c = 0; const params = { ...n.parameters };
    for (const f of fields) {
      if (typeof params[f] === 'string' && params[f].includes('app.nocodb.com')) {
        const m = params[f].match(FROM) || [];
        c += m.length;
        params[f] = params[f].replace(FROM, PROXY);
      }
    }
    if (c > 0) { count += c; hits.push(`${n.name} [${t.replace('n8n-nodes-base.', '')}] (${c})`); return { ...n, parameters: params }; }
    return n;
  });
  return { nodes, count, hits, credCount, credHits };
}

(async () => {
  if (revertIdx !== -1) {
    const backup = JSON.parse(fs.readFileSync(process.argv[revertIdx + 1], 'utf8'));
    const body = { name: backup.name, nodes: backup.nodes, connections: backup.connections, settings: cleanSettings(backup.settings) };
    const r = await fetch(`${N8N}/api/v1/workflows/${wfId}`, { method: 'PUT', headers: h, body: JSON.stringify(body) });
    console.log('REVERT', r.status, r.ok ? 'OK' : await r.text());
    return;
  }

  const wf = await getWf(wfId);
  const { nodes, count, hits, credCount, credHits } = transform(wf);
  console.log(`Workflow: ${wf.name} (${wfId})  active=${wf.active}`);
  console.log(`Reemplazos host→proxy (HTTP/Code): ${count} en ${hits.length} nodos:`);
  hits.forEach((x) => console.log('  -', x));
  console.log(`Swap credencial nativa→proxy: ${credCount} nodos:`);
  credHits.forEach((x) => console.log('  -', x));

  // Validación: el JSON resultante parsea y conserva el conteo de nodos/conexiones.
  const okNodes = nodes.length === wf.nodes.length;
  console.log(`Validación: nodos ${nodes.length}/${wf.nodes.length} ${okNodes ? 'OK' : 'MISMATCH'}`);

  if (!apply) {
    console.log('\n[DRY-RUN] No se aplicó nada. Re-correr con --apply para PUT (hace backup + toggle).');
    return;
  }

  // BACKUP antes de tocar
  const backupPath = `/tmp/wf_${wfId}_backup_${wf.versionId || 'x'}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));
  console.log('Backup:', backupPath);

  // PUT con solo las claves que el API acepta (gotcha documentado: settings rechaza claves no estándar)
  const body = { name: wf.name, nodes, connections: wf.connections, settings: cleanSettings(wf.settings) };
  const put = await fetch(`${N8N}/api/v1/workflows/${wfId}`, { method: 'PUT', headers: h, body: JSON.stringify(body) });
  console.log('PUT', put.status, put.ok ? 'OK' : await put.text());

  // Toggle para forzar reload del runtime (deactivate→activate) si estaba activo
  if (wf.active) {
    await fetch(`${N8N}/api/v1/workflows/${wfId}/deactivate`, { method: 'POST', headers: h });
    const act = await fetch(`${N8N}/api/v1/workflows/${wfId}/activate`, { method: 'POST', headers: h });
    console.log('Toggle activate', act.status);
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });

function cleanSettings(s) {
  const allowed = ['executionOrder', 'timezone', 'saveDataErrorExecution', 'saveDataSuccessExecution', 'saveExecutionProgress', 'saveManualExecutions', 'callerPolicy', 'executionTimeout', 'errorWorkflow'];
  const out = {}; for (const k of allowed) if (s && s[k] !== undefined) out[k] = s[k]; return out;
}
