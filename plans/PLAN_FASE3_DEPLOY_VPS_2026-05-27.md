# Fase 3 — Deploy al VPS · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Implementadores en **Sonnet**. Review final incluye un subagente de **errores + seguridad**.

**Goal:** Desplegar el Dashboard Yani Coach en el VPS (Traefik + Docker Swarm) sirviendo el diseño dorado aprobado, con login por contraseña y el sync refrescando datos solo cada hora — sin Vercel y sin tocar workflows operativos de n8n.

**Architecture:** Dos servicios en la overlay externa `Yanicoach`, ambos detrás de Traefik. `yani_dashboard_web` (nuevo): contenedor Express que sirve el bundle estático `dist/` y las 3 rutas `/api/auth/*`. `yani_dashboard_sync` (existente, extendido): mismo servicio HTTP, ahora con un timer interno que dispara el pipeline cada hora. Supabase es el espejo; el sync es el único puente NocoDB/Chatwoot→Supabase.

**Tech Stack:** Node 20 + Express 4 + tsx, Vite 6 (build estático), Docker Swarm + Portainer, Traefik (TLS Let's Encrypt), Supabase. Tests = scripts tsx con `node:assert/strict` (sin framework), corridos directo con `npx tsx <archivo>`.

**Spec:** `plans/SPEC_FASE3_DEPLOY_VPS_2026-05-27.md`

---

## Estructura de archivos

**Fase A — código local (subagentes, TDD):**

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `api/auth/core.ts` | Crear | Núcleo de auth agnóstico (HMAC cookie): sign/verify/cookies. DRY de los 3 wrappers Vercel. |
| `api/auth/core.test.ts` | Crear | Tests puros del núcleo de auth. |
| `scripts/web/server.ts` | Crear | Express: sirve `dist/` (SPA) + `/api/auth/*` + `/health`. |
| `scripts/sync/scheduler.ts` | Crear | `createGuardedRunner` (guarda anti-solape) + `startSchedule` (intervalo). |
| `scripts/sync/scheduler.test.ts` | Crear | Tests puros de la guarda anti-solape. |
| `scripts/sync/server.ts` | Modificar | Usar `createGuardedRunner` + timer 1h; compartir lógica con `POST /run`. |
| `scripts/sync/index.ts` | Modificar | Marcar `sync_run.status='error'` al fallar (fallo visible). |
| `App.tsx` | Modificar | Desmontar ChatAssistant (tab + botón + popup) — sin borrar el componente. |
| `.dockerignore` | Crear | Evitar hornear secretos/basura en las imágenes. |
| `Dockerfile.web` | Crear | Multi-stage: vite build → runtime Express. |
| `docker-stack.yml` | Crear | Stack Swarm con ambos servicios (reemplaza `docker-compose.sync.yml`). |
| `package.json` | Modificar | Quitar `@vercel/node`; agregar script `web`. |
| `vercel.json`, `vercel.env.example`, `api/chat.ts`, `api/auth/{login,logout,session}.ts` | Eliminar | Artefactos Vercel / chat IA fuera de alcance. |
| `docker-compose.sync.yml` | Eliminar | Reemplazado por `docker-stack.yml`. |

**Fase B — deploy en el VPS (runbook que ejecuta el usuario, el agente guía):** Task 9.

---

## Task 1: Núcleo de auth agnóstico (`api/auth/core.ts`)

**Files:**
- Create: `api/auth/core.ts`
- Test: `api/auth/core.test.ts`

- [ ] **Step 1: Escribir el test que falla**

`api/auth/core.test.ts`:

```ts
/**
 * Tests del núcleo de auth. Uso: npx tsx api/auth/core.test.ts
 */
import assert from 'node:assert/strict';
import {
  createSessionToken, verifyToken, buildCookie, buildClearCookie, parseCookies, COOKIE_NAME,
} from './core.js';

const SECRET = 'test-secret';

(async () => {
  // 1) round-trip firma/verificación
  {
    const token = createSessionToken(SECRET);
    const payload = verifyToken(token, SECRET);
    assert.ok(payload, 'token válido debe verificar');
    assert.equal(payload?.sub, 'yd-admin');
    assert.equal(payload?.name, 'Llave Dorada Yani');
  }
  // 2) secreto equivocado → rechazado
  {
    const token = createSessionToken(SECRET);
    assert.equal(verifyToken(token, 'otro-secret'), null);
  }
  // 3) token malformado → rechazado
  {
    assert.equal(verifyToken('sin-punto', SECRET), null);
  }
  // 4) payload manipulado con firma vieja → rechazado
  {
    const token = createSessionToken(SECRET);
    const sig = token.split('.')[1];
    const fake = Buffer.from(JSON.stringify({ sub: 'hacker' })).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    assert.equal(verifyToken(`${fake}.${sig}`, SECRET), null);
  }
  // 5) cookie en prod lleva Secure; fuera de prod no
  {
    const c = buildCookie('TOK', 100, true);
    assert.ok(c.startsWith(`${COOKIE_NAME}=TOK`));
    assert.ok(c.includes('HttpOnly'));
    assert.ok(c.includes('SameSite=Strict'));
    assert.ok(c.includes('Max-Age=100'));
    assert.ok(c.includes('Secure'));
    assert.ok(!buildCookie('TOK', 100, false).includes('Secure'));
  }
  // 6) clear cookie expira (Max-Age=0)
  {
    assert.ok(buildClearCookie(true).includes('Max-Age=0'));
  }
  // 7) parseCookies
  {
    const parsed = parseCookies('a=1; yd_auth=xyz; b=2');
    assert.equal(parsed['yd_auth'], 'xyz');
    assert.equal(parsed['a'], '1');
    assert.deepEqual(parseCookies(undefined), {});
  }
  console.log('✓ auth core: 7/7 casos pasaron');
})();
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx tsx api/auth/core.test.ts`
Expected: FAIL — `Cannot find module './core.js'` (o error de import), porque `core.ts` aún no existe.

- [ ] **Step 3: Implementar `api/auth/core.ts`**

```ts
/**
 * Núcleo de autenticación agnóstico al framework (sin tipos de Vercel ni Express).
 * Cookie firmada HMAC-SHA256 'yd_auth'. Mecánica idéntica a los handlers Vercel
 * originales (api/auth/{login,session,logout}.ts), centralizada para DRY.
 */
import crypto from 'node:crypto';

export const COOKIE_NAME = 'yd_auth';
export const COOKIE_TTL_SECONDS = 60 * 60 * 12; // 12 horas

export function base64Url(input: Buffer | string): string {
  const buffer = typeof input === 'string' ? Buffer.from(input) : input;
  return buffer.toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function sign(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return base64Url(hmac.digest());
}

export function createSessionToken(secret: string): string {
  const payload = JSON.stringify({ sub: 'yd-admin', iat: Date.now(), name: 'Llave Dorada Yani' });
  const payloadEncoded = base64Url(payload);
  return `${payloadEncoded}.${sign(payloadEncoded, secret)}`;
}

export function verifyToken(
  token: string,
  secret: string,
): { sub?: string; iat?: number; name?: string } | null {
  const [payloadEncoded, signature] = token.split('.');
  if (!payloadEncoded || !signature) return null;
  if (sign(payloadEncoded, secret) !== signature) return null;
  try {
    const json = Buffer.from(
      payloadEncoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64',
    ).toString();
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function buildCookie(value: string, maxAgeSeconds: number, isProduction: boolean): string {
  return [
    `${COOKIE_NAME}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`, isProduction ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

export function buildClearCookie(isProduction: boolean): string {
  return buildCookie('', 0, isProduction);
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((part) => {
    const [name, ...rest] = part.trim().split('=');
    cookies[name] = rest.join('=');
  });
  return cookies;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx tsx api/auth/core.test.ts`
Expected: PASS — `✓ auth core: 7/7 casos pasaron`

- [ ] **Step 5: Commit**

```bash
git add api/auth/core.ts api/auth/core.test.ts
git commit -m "feat(fase3): núcleo de auth agnóstico (core.ts) con tests"
```

---

## Task 2: Servidor web Express (`scripts/web/server.ts`)

**Files:**
- Create: `scripts/web/server.ts`
- Modify: `package.json` (agregar script `web`)

> No hay test unitario: los handlers son wrappers finos sobre `core.ts` (ya testeado). Se verifica por integración local con `curl`.

- [ ] **Step 1: Agregar el script `web` a `package.json`**

En la sección `"scripts"`, agregar la línea (después de `"sync": ...`):

```json
    "web": "tsx scripts/web/server.ts",
```

- [ ] **Step 2: Implementar `scripts/web/server.ts`**

```ts
/**
 * Servidor web de producción: sirve el bundle Vite (dist/) como SPA y expone
 * las rutas de auth por contraseña. Reemplaza a las serverless functions de Vercel.
 * Detrás de Traefik en el VPS. NO recibe service_role — solo anon (horneada en el
 * bundle en build-time) + AUTH_SECRET/AUTH_PASSWORD.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import {
  COOKIE_NAME, COOKIE_TTL_SECONDS, createSessionToken, verifyToken,
  buildCookie, buildClearCookie, parseCookies,
} from '../../api/auth/core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT ?? 8080);
const IS_PROD = process.env.NODE_ENV === 'production';
const AUTH_SECRET = process.env.AUTH_SECRET ?? '';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? '';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  if (!AUTH_SECRET || !AUTH_PASSWORD) {
    return res.status(500).json({ error: 'Configuración de autenticación incompleta' });
  }
  const provided = req.body?.password;
  if (!provided || provided !== AUTH_PASSWORD) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  const token = createSessionToken(AUTH_SECRET);
  res.setHeader('Set-Cookie', buildCookie(token, COOKIE_TTL_SECONDS, IS_PROD));
  return res.status(200).json({ authenticated: true, user: { name: 'Llave Dorada Yani' } });
});

app.get('/api/auth/session', (req, res) => {
  if (!AUTH_SECRET) {
    return res.status(500).json({ error: 'AUTH_SECRET no configurado' });
  }
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  const payload = token ? verifyToken(token, AUTH_SECRET) : null;
  if (!payload) {
    return res.status(200).json({ authenticated: false });
  }
  return res.status(200).json({ authenticated: true, user: { name: payload.name || 'Llave Dorada Yani' } });
});

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', buildClearCookie(IS_PROD));
  return res.status(200).json({ success: true });
});

// Estáticos + fallback SPA (toda ruta que no empiece con /api/ devuelve index.html)
app.use(express.static(DIST));
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[web] listening on :${PORT}`);
});
```

- [ ] **Step 3: Construir el bundle y levantar el server localmente**

```bash
npm run build
AUTH_SECRET=test-secret AUTH_PASSWORD=secreto NODE_ENV=development PORT=8080 npx tsx scripts/web/server.ts &
sleep 2
```

Nota: `npm run build` puede emitir un warning de Supabase si faltan `VITE_SUPABASE_*` en el entorno — es solo warning, el build igual produce `dist/`.

- [ ] **Step 4: Verificar health, login OK/málo, sesión y SPA**

```bash
curl -s localhost:8080/health
# Esperado: {"ok":true}
curl -s -i -X POST localhost:8080/api/auth/login -H 'content-type: application/json' -d '{"password":"secreto"}' | grep -i 'set-cookie'
# Esperado: línea Set-Cookie: yd_auth=...; HttpOnly; SameSite=Strict; Max-Age=43200
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8080/api/auth/login -H 'content-type: application/json' -d '{"password":"mal"}'
# Esperado: 401
curl -s localhost:8080/ | grep -o '<div id="root">'
# Esperado: <div id="root">  (index.html servido en la raíz)
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add scripts/web/server.ts package.json
git commit -m "feat(fase3): servidor web Express (estático SPA + /api/auth)"
```

---

## Task 3: `.dockerignore` + `Dockerfile.web`

**Files:**
- Create: `.dockerignore`
- Create: `Dockerfile.web`

- [ ] **Step 1: Crear `.dockerignore`**

```
node_modules
dist
.git
.env
.env.local
.env.*
*.log
.playwright-mcp
diseno-aprobado
plans
docs
.brain
screenshots
```

> Crítico de seguridad: excluye `.env*` para no hornear secretos (service_role, tokens) en la imagen.

- [ ] **Step 2: Crear `Dockerfile.web` (multi-stage)**

```dockerfile
# Web del Dashboard: build estático (Vite) + runtime Express.
# Build EN EL VPS desde la raíz del repo:
#   docker build -f Dockerfile.web \
#     --build-arg VITE_SUPABASE_URL=... \
#     --build-arg VITE_SUPABASE_ANON_KEY=... \
#     --build-arg VITE_SUPABASE_TENANT_ID=... \
#     -t yani-dashboard-web:local .

# ---- Stage 1: build del bundle ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_TENANT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_SUPABASE_TENANT_ID=$VITE_SUPABASE_TENANT_ID
RUN npm run build

# ---- Stage 2: runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache tini \
 && npm install --omit=dev --no-audit --no-fund \
      tsx@4.19.2 typescript@5.6.3 express@4.21.2 \
 && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY scripts/web/ ./scripts/web/
COPY api/auth/core.ts ./api/auth/core.ts
COPY tsconfig.json ./tsconfig.json
EXPOSE 8080
ENV NODE_ENV=production \
    PORT=8080
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "tsx", "scripts/web/server.ts"]
```

- [ ] **Step 3: Build local de la imagen para verificar que arma**

```bash
docker build -f Dockerfile.web \
  --build-arg VITE_SUPABASE_URL=https://dwnxldvrrzkqsqzlcvwt.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=dummy \
  --build-arg VITE_SUPABASE_TENANT_ID=7558d73a-e97b-4422-ab5c-db87f6626592 \
  -t yani-dashboard-web:local .
```
Expected: build termina sin error y crea la imagen `yani-dashboard-web:local`. (Si Docker no está disponible localmente, este paso se difiere al VPS en Task 9; dejarlo documentado y seguir.)

- [ ] **Step 4: Commit**

```bash
git add .dockerignore Dockerfile.web
git commit -m "feat(fase3): Dockerfile.web multi-stage + .dockerignore"
```

---

## Task 4: Guarda anti-solape + scheduler (`scripts/sync/scheduler.ts`)

**Files:**
- Create: `scripts/sync/scheduler.ts`
- Test: `scripts/sync/scheduler.test.ts`

- [ ] **Step 1: Escribir el test que falla**

`scripts/sync/scheduler.test.ts`:

```ts
/**
 * Tests de la guarda anti-solape. Uso: npx tsx scripts/sync/scheduler.test.ts
 */
import assert from 'node:assert/strict';
import { createGuardedRunner } from './scheduler.js';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

(async () => {
  // 1) Segundo trigger mientras el primero corre → skipped
  {
    const d = deferred<string>();
    const runner = createGuardedRunner(() => d.promise);
    const p1 = runner.trigger();
    const out2 = await runner.trigger();
    assert.deepEqual(out2, { skipped: true });
    assert.equal(runner.isRunning(), true);
    d.resolve('ok');
    const out1 = await p1;
    assert.deepEqual(out1, { skipped: false, result: 'ok' });
    assert.equal(runner.isRunning(), false);
  }
  // 2) Tras completar, se puede volver a disparar
  {
    const runner = createGuardedRunner(async () => 42);
    assert.deepEqual(await runner.trigger(), { skipped: false, result: 42 });
    assert.deepEqual(await runner.trigger(), { skipped: false, result: 42 });
  }
  // 3) runFn que lanza → el flag running se resetea (finally)
  {
    const runner = createGuardedRunner(async () => { throw new Error('boom'); });
    await assert.rejects(runner.trigger(), /boom/);
    assert.equal(runner.isRunning(), false);
  }
  console.log('✓ scheduler: 3/3 casos pasaron');
})();
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx tsx scripts/sync/scheduler.test.ts`
Expected: FAIL — no existe `./scheduler.js`.

- [ ] **Step 3: Implementar `scripts/sync/scheduler.ts`**

```ts
/**
 * Guarda anti-solape para el pipeline de sync + helper de intervalo.
 * `createGuardedRunner` garantiza que nunca corran dos syncs en paralelo
 * (el `POST /run` manual y el timer comparten la misma guarda).
 */
export function createGuardedRunner<T>(runFn: () => Promise<T>) {
  let running = false;
  async function trigger(): Promise<{ skipped: true } | { skipped: false; result: T }> {
    if (running) return { skipped: true };
    running = true;
    try {
      const result = await runFn();
      return { skipped: false, result };
    } finally {
      running = false;
    }
  }
  return { trigger, isRunning: () => running };
}

/** Dispara `trigger` cada `intervalMs`. Errores se loguean, no tumban el proceso. */
export function startSchedule(intervalMs: number, trigger: () => Promise<unknown>): NodeJS.Timeout {
  return setInterval(() => {
    trigger().catch((err) => console.error('[scheduler] run falló:', err));
  }, intervalMs);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx tsx scripts/sync/scheduler.test.ts`
Expected: PASS — `✓ scheduler: 3/3 casos pasaron`

- [ ] **Step 5: Commit**

```bash
git add scripts/sync/scheduler.ts scripts/sync/scheduler.test.ts
git commit -m "feat(fase3): guarda anti-solape + scheduler con tests"
```

---

## Task 5: Cablear timer 1h en `scripts/sync/server.ts`

**Files:**
- Modify: `scripts/sync/server.ts` (reescritura completa del archivo)

- [ ] **Step 1: Reemplazar el contenido de `scripts/sync/server.ts`**

```ts
/**
 * HTTP wrapper del sync pipeline.
 *   GET  /health → 200 si el proceso vive (+ flag running)
 *   POST /run    → ejecuta el pipeline; 200/500 según resultado, 409 si ya corre
 * Timer interno: dispara el pipeline cada 1h (frescura del espejo Supabase).
 * `POST /run` y el timer comparten la misma guarda anti-solape (scheduler.ts).
 *
 * Seguridad: el service sólo escucha en la overlay interna de Swarm. No hay auth.
 */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import express from 'express';
import { createGuardedRunner, startSchedule } from './scheduler.js';

const PORT = Number(process.env.PORT ?? 3000);
const ROOT = resolve(process.cwd());
const SYNC_ENTRY = resolve(ROOT, 'scripts/sync/index.ts');
const MAX_DURATION_MS = 10 * 60 * 1000;       // 10 min — el sync real tarda ~90s
const SYNC_INTERVAL_MS = 60 * 60 * 1000;      // 1h — frescura del espejo

interface RunResult {
  ok: boolean;
  exit_code: number | null;
  signal: NodeJS.Signals | null;
  elapsed_ms: number;
  log: string;
}

function runPipeline(): Promise<RunResult> {
  return new Promise((resolveRun) => {
    const started = Date.now();
    const chunks: string[] = [];
    const child = spawn('npx', ['tsx', SYNC_ENTRY], {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000);
    }, MAX_DURATION_MS);

    child.stdout.on('data', (d) => chunks.push(d.toString()));
    child.stderr.on('data', (d) => chunks.push(d.toString()));

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolveRun({
        ok: code === 0,
        exit_code: code,
        signal,
        elapsed_ms: Date.now() - started,
        log: chunks.join('').slice(-4000),
      });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolveRun({ ok: false, exit_code: null, signal: null, elapsed_ms: Date.now() - started, log: String(err) });
    });
  });
}

const runner = createGuardedRunner(runPipeline);

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, running: runner.isRunning() });
});

app.post('/run', async (_req, res) => {
  const out = await runner.trigger();
  if (out.skipped) {
    return res.status(409).json({ ok: false, error: 'sync already in progress' });
  }
  return res.status(out.result.ok ? 200 : 500).json(out.result);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[sync-server] listening on :${PORT}`);
  startSchedule(SYNC_INTERVAL_MS, async () => {
    console.log('[scheduler] disparando sync programado...');
    const out = await runner.trigger();
    if (out.skipped) console.warn('[scheduler] sync ya en curso, salteo esta vuelta');
    else if (!out.result.ok) console.error('[scheduler] sync falló:', out.result.log);
    else console.log(`[scheduler] sync ok en ${out.result.elapsed_ms}ms`);
  });
});
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (sin errores).

- [ ] **Step 3: Smoke local del server de sync (health responde con `running`)**

```bash
PORT=3000 npx tsx scripts/sync/server.ts &
sleep 2
curl -s localhost:3000/health
# Esperado: {"ok":true,"running":false}
kill %1
```
> No disparar `POST /run` aquí (golpearía NocoDB/Supabase reales). Eso se valida en el VPS.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync/server.ts
git commit -m "feat(fase3): timer interno 1h en sync server (guarda compartida con /run)"
```

---

## Task 6: Fallo visible — marcar `sync_run` como error (`scripts/sync/index.ts`)

**Files:**
- Modify: `scripts/sync/index.ts`

- [ ] **Step 1: Agregar `closeRunError` junto a `closeRun`**

Después de la función `closeRun` existente, agregar:

```ts
async function closeRunError(runId: string, err: unknown) {
  // Fallo VISIBLE (regla cero-tolerancia): el run queda como 'error' en sync_runs,
  // consultable desde el dashboard/Supabase, en vez de tragarse en silencio.
  console.error(`  ⚠ marcando sync_run ${runId} como error`);
  await supabaseAdmin
    .from('sync_runs')
    .update({ status: 'error', finished_at: new Date().toISOString() })
    .eq('id', runId);
}
```

- [ ] **Step 2: Usar `closeRunError` en el catch del loop de tablas**

En `main()`, reemplazar el bloque catch existente:

```ts
    } catch (e) {
      console.error(`\n✗ Sync ${name} falló:`, e);
      process.exit(1);
    }
```

por:

```ts
    } catch (e) {
      console.error(`\n✗ Sync ${name} falló:`, e);
      await closeRunError(runId, e);
      process.exit(1);
    }
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync/index.ts
git commit -m "feat(fase3): marcar sync_run como error al fallar (fallo visible)"
```

---

## Task 7: Desmontar ChatAssistant + eliminar artefactos Vercel

**Files:**
- Modify: `App.tsx`
- Modify: `package.json` (quitar `@vercel/node`)
- Delete: `vercel.json`, `vercel.env.example`, `api/chat.ts`, `api/auth/login.ts`, `api/auth/logout.ts`, `api/auth/session.ts`, `docker-compose.sync.yml`

> El componente `components/ChatAssistant.tsx` y `services/chatService.ts` NO se borran (quedan para cuando se retome el chat IA); solo se dejan de montar.

- [ ] **Step 1: Editar imports en `App.tsx` (línea 3 y 9)**

Quitar `MessageCircle, X` del import de `lucide-react` (línea 3). Queda:

```ts
import { LayoutDashboard, BarChart3, DollarSign, UserCheck, GitBranch, RefreshCw } from 'lucide-react';
```

Borrar la línea 9 completa:

```ts
import ChatAssistant from './components/ChatAssistant';
```

- [ ] **Step 2: Quitar el estado y el tipo del tab `assistant`**

Línea 18 — quitar `'assistant'` del union de `activeTab`:

```ts
  const [activeTab, setActiveTab] = useState<'executive' | 'sales' | 'performance' | 'pipeline'>('executive');
```

Línea 19 — borrar la línea de estado del chat:

```ts
  const [isChatOpen, setIsChatOpen] = useState(false);
```

- [ ] **Step 3: Quitar el item de nav `assistant` (línea ~91)**

Borrar la línea del array de tabs:

```ts
    { id: 'assistant', label: 'Asistente Yani', icon: <MessageCircle className="w-4 h-4" /> },
```

- [ ] **Step 4: Quitar el render del tab assistant (líneas ~232-234)**

Borrar el bloque:

```tsx
              {activeTab === 'assistant' && (
                <ChatAssistant />
              )}
```

- [ ] **Step 5: Quitar el botón flotante y el popup (líneas ~238-274)**

Borrar desde el comentario `{/* Floating Chat Button */}` hasta el cierre del bloque `{isChatOpen && ( ... )}` inclusive — es decir, el `<button ...>` flotante con `MessageCircle` y todo el `{isChatOpen && (<div ...>...</div>)}`.

- [ ] **Step 6: Eliminar artefactos Vercel y la dependencia**

```bash
git rm vercel.json vercel.env.example api/chat.ts api/auth/login.ts api/auth/logout.ts api/auth/session.ts docker-compose.sync.yml
npm uninstall @vercel/node
```

- [ ] **Step 7: Verificar typecheck y build**

```bash
npx tsc --noEmit
npm run build
```
Expected: ambos PASS. El typecheck confirma que no quedó ninguna referencia colgada a `ChatAssistant`, `MessageCircle`, `X` ni `isChatOpen` en `App.tsx`.

- [ ] **Step 8: Commit**

```bash
git add App.tsx package.json package-lock.json
git commit -m "feat(fase3): desmontar chat IA + eliminar artefactos Vercel"
```

---

## Task 8: Stack Swarm (`docker-stack.yml`)

**Files:**
- Create: `docker-stack.yml`

- [ ] **Step 1: Crear `docker-stack.yml`**

```yaml
# Stack del Dashboard Yani Coach para Portainer (Docker Swarm).
# Servicios: web (estático + auth) y sync (espejo NocoDB->Supabase, timer 1h).
#
# Deploy EN EL VPS:
#   1. docker build -f Dockerfile.web --build-arg VITE_SUPABASE_URL=... \
#        --build-arg VITE_SUPABASE_ANON_KEY=... --build-arg VITE_SUPABASE_TENANT_ID=... \
#        -t yani-dashboard-web:local .
#   2. docker build -f scripts/sync/Dockerfile -t yani-dashboard-sync:local .
#   3. Portainer -> Stacks -> Add stack -> pegar este YAML -> setear env -> Deploy
#
# ⚠ Confirmá los nombres reales de entrypoint y certresolver de Traefik contra un
#   servicio ya enrutado (ver Task 9, Step 1). Acá usamos los convencionales
#   `websecure` y `letsencrypt`; ajustá si tu Traefik usa otros.

services:
  yani_dashboard_web:
    image: yani-dashboard-web:local
    environment:
      NODE_ENV: "production"
      PORT: "8080"
      AUTH_PASSWORD: "${AUTH_PASSWORD:?set AUTH_PASSWORD}"
      AUTH_SECRET: "${AUTH_SECRET:?set AUTH_SECRET}"
    networks:
      - yanicoach
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
        delay: 10s
        max_attempts: 3
      resources:
        limits:
          memory: 256M
        reservations:
          memory: 64M
      labels:
        - "traefik.enable=true"
        - "traefik.docker.network=Yanicoach"
        - "traefik.http.routers.yanidash.rule=Host(`${DASHBOARD_DOMAIN:?set DASHBOARD_DOMAIN}`)"
        - "traefik.http.routers.yanidash.entrypoints=websecure"
        - "traefik.http.routers.yanidash.tls=true"
        - "traefik.http.routers.yanidash.tls.certresolver=letsencrypt"
        - "traefik.http.services.yanidash.loadbalancer.server.port=8080"
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:8080/health', r => r.statusCode===200?process.exit(0):process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s

  yani_dashboard_sync:
    image: yani-dashboard-sync:local
    environment:
      VITE_NOCODB_URL: "${VITE_NOCODB_URL:-https://app.nocodb.com}"
      VITE_NOCODB_TOKEN: "${VITE_NOCODB_TOKEN:?set VITE_NOCODB_TOKEN}"
      VITE_TABLE_SELLERS: "${VITE_TABLE_SELLERS:-me6kwgo0qvg0aug}"
      VITE_TABLE_CONTACTS: "${VITE_TABLE_CONTACTS:-mrwhtwissgz1xzr}"
      VITE_TABLE_INTERACTIONS: "${VITE_TABLE_INTERACTIONS:-m6gx25reozjbbt3}"
      VITE_TABLE_SALES: "${VITE_TABLE_SALES:-mm9p02mlk0i5ysy}"
      VITE_TABLE_ATTEMPTS: "${VITE_TABLE_ATTEMPTS:-mqdlglkwjvvtplc}"
      SUPABASE_URL: "${SUPABASE_URL:?set SUPABASE_URL}"
      SUPABASE_SERVICE_ROLE_KEY: "${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY}"
      SUPABASE_TENANT_SLUG: "${SUPABASE_TENANT_SLUG:-yani-coach}"
      PORT: "3000"
      NODE_ENV: "production"
    networks:
      - yanicoach
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
        delay: 10s
        max_attempts: 3
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 128M
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', r => r.statusCode===200?process.exit(0):process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s

networks:
  yanicoach:
    external: true
    name: Yanicoach
```

- [ ] **Step 2: Validar la sintaxis del compose (si hay docker local)**

```bash
docker compose -f docker-stack.yml config >/dev/null && echo "OK sintaxis"
```
Expected: `OK sintaxis`. (Si no hay docker local, diferir al VPS en Task 9; los `${VAR:?...}` van a quejarse si no están seteadas — está bien, es solo validación de forma.)

- [ ] **Step 3: Commit**

```bash
git add docker-stack.yml
git commit -m "feat(fase3): stack Swarm (web + sync) con labels Traefik"
```

---

## Task 9: Runbook de deploy EN EL VPS (ejecuta el usuario; el agente guía)

> Esta tarea NO la corre un subagente: requiere acceso al VPS (SSH/Portainer) que el
> agente no tiene. Es la guía paso a paso que el usuario sigue, con el agente
> asistiendo en vivo. Marcar los pasos a medida que se completan.

- [ ] **Step 1: Confirmar los nombres de Traefik de un servicio ya enrutado**

En el VPS:
```bash
docker service ls | grep -iE 'n8n|chatwoot'
docker service inspect <nombre_servicio_n8n> --format '{{json .Spec.Labels}}' | tr ',' '\n' | grep -i traefik
```
Anotar el valor real de `entrypoints` (¿`websecure`?) y `certresolver` (¿`letsencrypt`? ¿`le`?). Si difieren de los del `docker-stack.yml`, editar las labels del servicio `yani_dashboard_web` para que coincidan.

- [ ] **Step 2: Definir el dominio y crear el registro DNS**

Elegir `${DASHBOARD_DOMAIN}` (ej: `dashboard.yanicoach.com`) y crear un registro **A** apuntando a la IP pública del VPS. Verificar:
```bash
dig +short ${DASHBOARD_DOMAIN}
# Esperado: la IP del VPS
```

- [ ] **Step 3: Traer el repo al VPS y construir ambas imágenes**

```bash
# en el VPS, en la raíz del repo (rama de Fase 3)
docker build -f Dockerfile.web \
  --build-arg VITE_SUPABASE_URL="$SUPABASE_URL" \
  --build-arg VITE_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  --build-arg VITE_SUPABASE_TENANT_ID="7558d73a-e97b-4422-ab5c-db87f6626592" \
  -t yani-dashboard-web:local .
docker build -f scripts/sync/Dockerfile -t yani-dashboard-sync:local .
```
> `VITE_SUPABASE_ANON_KEY` es la anon key pública (segura en el browser). El `service_role` NO va acá; solo va como env del servicio sync en el stack.

- [ ] **Step 4: Desplegar el stack en Portainer**

Portainer → Stacks → Add stack → pegar `docker-stack.yml`. En *Environment variables* setear:
`DASHBOARD_DOMAIN`, `AUTH_PASSWORD`, `AUTH_SECRET`, `VITE_NOCODB_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (y opcionalmente `SUPABASE_TENANT_SLUG`, IDs de tabla). Deploy.

- [ ] **Step 5: Verificar servicios arriba y healthchecks**

```bash
docker stack services <nombre_stack>
# Esperado: yani_dashboard_web 1/1, yani_dashboard_sync 1/1
docker service logs <stack>_yani_dashboard_web --tail 20   # "[web] listening on :8080"
docker service logs <stack>_yani_dashboard_sync --tail 20  # "[sync-server] listening on :3000"
```

- [ ] **Step 6: Verificar TLS + login en el browser**

Abrir `https://${DASHBOARD_DOMAIN}`: cert válido, aparece `LoginView` dorado, login con `AUTH_PASSWORD` entra, contraseña errada da error.

- [ ] **Step 7: Smoke Playwright contra producción (0 errores de consola)**

Con el setup Playwright existente, navegar a `https://${DASHBOARD_DOMAIN}`, login, confirmar que el embudo y KPIs renderizan con datos reales y que la consola no tiene errores.

- [ ] **Step 8: Verificar el sync programado**

Disparar una corrida manual y confirmar registro:
```bash
docker exec $(docker ps -qf name=yani_dashboard_sync) sh -c "wget -qO- --post-data='' http://localhost:3000/run" || true
```
Luego en Supabase: `SELECT table_name, status, started_at, finished_at FROM sync_runs ORDER BY started_at DESC LIMIT 8;` — deben aparecer corridas `success` (o `error` visible si algo falló). Confirmar que en ~1h el timer dispara solo.

- [ ] **Step 9: Verificar que el service_role no está en el bundle (seguridad)**

```bash
docker run --rm --entrypoint sh yani-dashboard-web:local -c "grep -rl 'service_role' /app/dist || echo 'OK: sin service_role en el bundle'"
```
Expected: `OK: sin service_role en el bundle`.

---

## Self-Review

**Cobertura del spec:**
- Traefik + dominio parametrizado → Task 8 (labels) + Task 9 (DNS/confirmación). ✓
- Login por contraseña, sin chat IA → Task 1 (core), Task 2 (rutas), Task 7 (desmontar chat). ✓
- Contenedor Express único (estático + auth) → Task 2 + Task 3. ✓
- Timer interno 1h → Task 4 + Task 5. ✓
- Fallo visible en sync_runs → Task 6. ✓
- Stack único reemplaza compose → Task 8 + borrado en Task 7. ✓
- Seguridad (service_role solo en sync; no en bundle) → `.dockerignore` Task 3, Task 9 Step 9. ✓
- Deprecaciones (vercel.json, api/chat, @vercel/node, wrappers auth) → Task 7. ✓
- Testing (core, scheduler, integración, Playwright) → Tasks 1, 4, 2, 9. ✓

**Placeholder scan:** sin TBD/TODO. Los pasos que dependen de Docker/VPS están marcados como diferibles a Task 9 con comando concreto. El `VITE_SUPABASE_TENANT_ID` está fijado al UUID real conocido.

**Consistencia de tipos/nombres:** `createGuardedRunner`/`startSchedule` (Task 4) usados igual en Task 5; `createSessionToken`/`verifyToken`/`buildCookie`/`buildClearCookie`/`parseCookies`/`COOKIE_NAME`/`COOKIE_TTL_SECONDS` (Task 1) usados igual en Task 2; `closeRunError` (Task 6) coherente con el `closeRun` existente; puerto web 8080 consistente entre Task 2/3/8.
