/**
 * NocoDB Pacing Proxy — cura definitiva del 429 (rate limit 5 req/s por cuenta).
 *
 * Qué hace (y SOLO esto):
 *  1. Reverse-proxy transparente a NocoDB Cloud. Reenvía path + método + headers + body
 *     tal cual. AUTH-AGNÓSTICO: respeta el header de auth que ya manda cada nodo n8n
 *     (xc-token / Authorization). No reescribe credenciales → el cutover es un puro
 *     cambio de host en las URLs, sin tocar las 6 formas de auth del sistema.
 *  2. Token-bucket GLOBAL: limita el ritmo agregado de TODAS las llamadas a < 5/s, sin
 *     importar cuántos workflows disparen a la vez. Mata la colisión de concurrencia.
 *  3. Backoff 429 + AIMD: ante 429/5xx de NocoDB, honra `Retry-After` o backoff corto y
 *     reintenta de forma transparente al caller (solo esa request espera). Ante 429 baja el
 *     RITMO AGREGADO (multiplicative decrease) y lo recupera gradual (additive increase), en
 *     vez de CONGELAR toda la cola. Así NocoDB respira sin serializar todo el tráfico a ~1/min
 *     (bug del amplificador de penalty que colapsaba el throughput bajo carga).
 *  4. Prioridad: tráfico en vivo > batch. Un cron/masivo manda `x-noco-priority: low` y no
 *     congela a los leads en vivo.
 *
 * Ejecutar: npx tsx scripts/nocodb-proxy/proxy.ts   (igual patrón que scripts/sync)
 */

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

// ---- Config (env, con defaults seguros) ----
const PORT = Number(process.env.PORT ?? 8090);
const UPSTREAM = (process.env.NOCODB_UPSTREAM ?? 'https://app.nocodb.com').replace(/\/$/, '');
const RATE_PER_SEC = Number(process.env.RATE_PER_SEC ?? 4); // < 5/s del límite NocoDB
const BUCKET_CAPACITY = Number(process.env.BUCKET_CAPACITY ?? 4); // ráfaga máxima
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS ?? 8);
const MAX_BACKOFF_MS = Number(process.env.MAX_BACKOFF_MS ?? 30000);
// Backoff por-request más corto: el retry de UNA request no debe hacerla colgar 30s.
// El control de ritmo agregado lo hace el AIMD (abajo), no la espera individual.
const MAX_RETRY_BACKOFF_MS = Number(process.env.MAX_RETRY_BACKOFF_MS ?? 4000); // cap 4s por intento
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 25000); // por intento upstream
const MAX_QUEUE = Number(process.env.MAX_QUEUE ?? 2000); // backstop anti-OOM
// ---- AIMD (control adaptativo del ritmo ante 429) ----
// En vez de CONGELAR toda la cola cuando alguien pega un 429 (el bug amplificador),
// bajamos el ritmo agregado y lo recuperamos gradual. Todos siguen fluyendo, más lento.
const MIN_RATE_PER_SEC = Number(process.env.MIN_RATE_PER_SEC ?? 1); // piso: nunca frenar del todo
const RATE_DECREASE_FACTOR = Number(process.env.RATE_DECREASE_FACTOR ?? 0.5); // multiplicative decrease
const RATE_RECOVER_PER_SEC = Number(process.env.RATE_RECOVER_PER_SEC ?? 0.5); // additive increase (req/s por s sano)
const RATE_DECREASE_DEBOUNCE_MS = Number(process.env.RATE_DECREASE_DEBOUNCE_MS ?? 500); // un burst de 429 = 1 sola bajada
// Inyección opcional de token (default: passthrough, NO inyecta). Para la fase de hardening.
const INJECT_TOKEN = process.env.NOCODB_INJECT_TOKEN ?? '';

if (Number.isNaN(PORT) || PORT <= 0) throw new Error('PORT inválido');

const upstreamUrl = new URL(UPSTREAM);
const upstreamIsHttps = upstreamUrl.protocol === 'https:';
const upstreamMod = upstreamIsHttps ? https : http;
const upstreamAgent = upstreamIsHttps
  ? new https.Agent({ keepAlive: true, maxSockets: 8 })
  : new http.Agent({ keepAlive: true, maxSockets: 8 });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- Token bucket global con prioridad ----
type Waiter = { resolve: () => void };
const highQ: Waiter[] = []; // tráfico en vivo (default)
const lowQ: Waiter[] = []; // batch / crons

let tokens = BUCKET_CAPACITY;
let lastRefill = Date.now();
let effectiveRate = RATE_PER_SEC; // AIMD: ritmo real (req/s). Baja en 429, sube gradual sin 429.
let lastDecrease = 0; // debounce para no colapsar al piso ante un burst simultáneo de 429

// métricas
const stats = { received: 0, forwarded: 0, retried: 0, got429: 0, errors: 0, rejected: 0 };

function refill() {
  const now = Date.now();
  const elapsed = (now - lastRefill) / 1000;
  if (elapsed > 0) {
    // Recuperación aditiva del ritmo (AIMD): si venimos ralentizados por 429s, subimos de a poco.
    if (effectiveRate < RATE_PER_SEC) {
      effectiveRate = Math.min(RATE_PER_SEC, effectiveRate + elapsed * RATE_RECOVER_PER_SEC);
    }
    // El bucket se llena al ritmo EFECTIVO actual, no al nominal.
    tokens = Math.min(BUCKET_CAPACITY, tokens + elapsed * effectiveRate);
    lastRefill = now;
  }
}

/** Espera hasta tener un slot de ritmo (un token) respetando prioridad y penalización. */
function acquire(priority: 'high' | 'low'): Promise<void> {
  return new Promise((resolve, reject) => {
    const q = priority === 'low' ? lowQ : highQ;
    if (highQ.length + lowQ.length >= MAX_QUEUE) {
      stats.rejected++;
      return reject(new Error('proxy queue full'));
    }
    q.push({ resolve });
  });
}

// Scheduler central: corre ~cada 25ms, reparte tokens al de mayor prioridad.
// Ya NO congela a todos ante un 429: el ritmo se autorregula vía effectiveRate (AIMD).
setInterval(() => {
  refill();
  while (tokens >= 1 && (highQ.length || lowQ.length)) {
    const w = highQ.shift() ?? lowQ.shift()!;
    tokens -= 1;
    w.resolve();
  }
}, 25).unref();

/**
 * Multiplicative decrease del ritmo agregado tras un 429 (AIMD).
 * NO congela la cola: baja effectiveRate y drena tokens para no re-burstear.
 * Debounce: un burst de 429 simultáneos cuenta como UNA sola bajada (no colapsa al piso).
 */
function on429() {
  const now = Date.now();
  if (now - lastDecrease < RATE_DECREASE_DEBOUNCE_MS) return;
  effectiveRate = Math.max(MIN_RATE_PER_SEC, effectiveRate * RATE_DECREASE_FACTOR);
  tokens = Math.min(tokens, effectiveRate); // evita gastar burst acumulado justo tras el 429
  lastDecrease = now;
}

// ---- Forward de un request al upstream, con un intento ----
function forwardOnce(
  method: string,
  path: string,
  headers: http.IncomingHttpHeaders,
  body: Buffer,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const outHeaders: Record<string, string | string[]> = {};
    // Copiamos headers del caller salvo los de hop/host.
    for (const [k, v] of Object.entries(headers)) {
      const lk = k.toLowerCase();
      if (['host', 'connection', 'content-length', 'transfer-encoding', 'x-noco-priority'].includes(lk)) continue;
      if (v !== undefined) outHeaders[k] = v as string | string[];
    }
    outHeaders['host'] = upstreamUrl.host;
    if (body.length) outHeaders['content-length'] = String(body.length);
    // Inyección opcional de token SOLO si el caller no trae auth (fase hardening).
    if (INJECT_TOKEN && !headers['xc-token'] && !headers['authorization']) {
      outHeaders['xc-token'] = INJECT_TOKEN;
    }

    const req = upstreamMod.request(
      {
        protocol: upstreamUrl.protocol,
        hostname: upstreamUrl.hostname,
        port: upstreamUrl.port || 443,
        method,
        path,
        headers: outHeaders,
        agent: upstreamAgent,
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
      },
    );
    req.on('timeout', () => req.destroy(new Error('upstream timeout')));
    req.on('error', reject);
    if (body.length) req.write(body);
    req.end();
  });
}

/** Forward con pacing + retry/backoff transparente. */
async function pacedForward(
  method: string,
  path: string,
  headers: http.IncomingHttpHeaders,
  body: Buffer,
  priority: 'high' | 'low',
) {
  let lastStatus = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await acquire(priority); // espera slot de ritmo (respeta castigo global)
    const res = await forwardOnce(method, path, headers, body);
    lastStatus = res.status;
    if (res.status !== 429 && res.status < 500) {
      stats.forwarded++;
      return res; // éxito (incluye 4xx legítimos como 400/404 — se devuelven al caller)
    }
    // 429 o 5xx transitorio → backoff + reintento transparente
    if (res.status === 429) stats.got429++;
    if (attempt < MAX_ATTEMPTS) {
      // Ante 429 bajamos el ritmo AGREGADO (AIMD), no congelamos la cola. Los demás siguen fluyendo.
      if (res.status === 429) on429();
      // Backoff de ESTA request solamente. Cap bajo (Retry-After manda si viene) para no colgarla 30s.
      const retryAfter = Number(res.headers['retry-after']);
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(MAX_BACKOFF_MS, retryAfter * 1000) // Retry-After explícito de NocoDB: lo respetamos
        : Math.min(MAX_RETRY_BACKOFF_MS, 500 * 2 ** (attempt - 1)); // 0.5,1,2,4,4s (cap corto)
      stats.retried++;
      await sleep(backoff);
      continue;
    }
    return res; // agotados los reintentos: devolvemos lo último (el caller verá el 429/5xx)
  }
  throw new Error(`pacedForward agotado (${lastStatus})`);
}

// ---- HTTP server ----
const server = http.createServer((clientReq, clientRes) => {
  const url = clientReq.url ?? '/';

  // Endpoints locales (no se reenvían)
  if (url === '/health') {
    clientRes.writeHead(200, { 'content-type': 'application/json' });
    clientRes.end(JSON.stringify({ ok: true, throttled: effectiveRate < RATE_PER_SEC, rate: Number(effectiveRate.toFixed(2)) }));
    return;
  }
  if (url === '/_proxy_stats') {
    clientRes.writeHead(200, { 'content-type': 'application/json' });
    // inPenalty ahora = "ritmo por debajo del nominal" (AIMD activo), no un freeze global.
    clientRes.end(JSON.stringify({ ...stats, queued: highQ.length + lowQ.length, tokens: Math.floor(tokens), rate: Number(effectiveRate.toFixed(2)), inPenalty: effectiveRate < RATE_PER_SEC }));
    return;
  }

  stats.received++;
  const priority: 'high' | 'low' = String(clientReq.headers['x-noco-priority'] ?? '').toLowerCase() === 'low' ? 'low' : 'high';

  const chunks: Buffer[] = [];
  clientReq.on('data', (c) => chunks.push(c));
  clientReq.on('end', async () => {
    const body = Buffer.concat(chunks);
    try {
      const res = await pacedForward(clientReq.method ?? 'GET', url, clientReq.headers, body, priority);
      const outHeaders: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(res.headers)) {
        if (['transfer-encoding', 'connection', 'content-length'].includes(k.toLowerCase())) continue;
        if (v !== undefined) outHeaders[k] = v as string | string[];
      }
      outHeaders['content-length'] = String(res.body.length);
      clientRes.writeHead(res.status, outHeaders);
      clientRes.end(res.body);
    } catch (err) {
      stats.errors++;
      clientRes.writeHead(502, { 'content-type': 'application/json' });
      clientRes.end(JSON.stringify({ proxy_error: String((err as Error).message ?? err) }));
    }
  });
  clientReq.on('error', () => {
    stats.errors++;
    if (!clientRes.headersSent) clientRes.writeHead(400);
    clientRes.end();
  });
});

server.listen(PORT, () => {
  console.log(`[nocodb-proxy] escuchando :${PORT} → ${UPSTREAM} | ${RATE_PER_SEC} req/s, burst ${BUCKET_CAPACITY}, inject-token=${INJECT_TOKEN ? 'on' : 'off (passthrough)'}`);
});

// stats periódicas (visibilidad en logs del contenedor)
setInterval(() => {
  if (stats.received) console.log(`[nocodb-proxy] stats ${JSON.stringify({ ...stats, queued: highQ.length + lowQ.length, rate: Number(effectiveRate.toFixed(2)), inPenalty: effectiveRate < RATE_PER_SEC })}`);
}, 60000).unref();

const shutdown = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
