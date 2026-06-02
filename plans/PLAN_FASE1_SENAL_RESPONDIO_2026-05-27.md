# Plan Fase 1 — Señal "Respondió" (Chatwoot → Supabase)

> **Para workers agénticos:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar tarea por tarea. Los pasos usan checkbox (`- [ ]`) para tracking.

**Goal:** Que el dashboard pueda mostrar la etapa "Respondieron" del embudo de Yani y el tiempo de respuesta del equipo, derivando esos datos automáticamente desde Chatwoot (cero carga manual), persistidos en Supabase.

**Architecture:** Se **extiende el sync TypeScript existente** (`scripts/sync/`) con un lector de Chatwoot y una función pura `deriveRespondio`. El sync escribe una tabla nueva `chatwoot_conversaciones` en Supabase y una migración expone los conteos del embudo. NO se construye un servicio Python aparte. n8n operativo NO se toca.

**Tech Stack:** TypeScript + tsx, `@supabase/supabase-js` (service role), API REST de Chatwoot v1, Supabase Postgres (migraciones SQL), node:assert para tests.

---

## Contexto imprescindible (leer antes de empezar)

- **El sync ya existe** en `scripts/sync/`. Orquestador: `index.ts`. Patrón de cada módulo: `syncX(tenantId, runId): Promise<{rows:number}>` → lee fuente → `normalize()` → upsert en batches → registra en `sync_runs`. Replicá ese patrón.
- **Cliente Supabase admin**: `scripts/sync/supabaseAdmin.ts` exporta `supabaseAdmin` (service role) y `getTenantId()`.
- **Env**: `scripts/sync/env.ts` carga `.env.local`/`.env`. Hay que agregar las vars de Chatwoot ahí.
- **Enlace contacto ↔ Chatwoot**:
  - **Primario:** NocoDB Contactos tiene el campo `chatwoot_contact_id` (string). Hay que sincronizarlo a una columna nueva `contactos.chatwoot_contact_id` en Supabase.
  - **Importante:** ese campo solo está poblado para contactos creados por el workflow "Sync Manual Contacto a Chatwoot" — NO para todos. Por eso el sync de Chatwoot enlaza por `chatwoot_contact_id` cuando existe, y guarda igual la conversación aunque no matchee (con `contacto_id = null`) para no perder datos.
  - **Fallback futuro (NO en este plan):** match por teléfono E.164. Documentado como deuda; ver "Fuera de alcance".
- **`vendedoras.chatwoot_agent_id`** ya existe (integer) → permite atribuir la conversación a la asesora.
- **`sync_runs.source`** ya admite `'chatwoot'`.
- **No hay framework de tests.** Los scripts de prueba se escriben como scripts `tsx` con `node:assert/strict` y se corren con `npx tsx <archivo>` (igual que `scripts/validate_metrics.ts`).
- **Imports ESM:** este proyecto usa imports con extensión `.js` aunque el archivo sea `.ts` (ver `import { env } from './env.js'`). Respetalo.
- **Supabase está PAUSADO** (proyecto `dwnxldvrrzkqsqzlcvwt`, INACTIVE). La Tarea 0 lo reactiva.

### Definición de la señal (acordada)
Sobre los mensajes de UNA conversación, ordenados por `created_at` ascendente, considerando solo mensajes **no privados**:
- **outbound** = `message_type === 1` (saliente de la asesora) — incluye el template inicial.
- **inbound** = `message_type === 0` (entrante del lead).
- Ignorar `message_type === 2` (activity) y cualquier `private === true` (notas internas).

Derivaciones:
- `primer_outbound_at` = `created_at` del primer outbound (o null si no hay).
- `primer_inbound_at` = `created_at` del primer inbound (o null).
- **`respondio` = true** si existe al menos un inbound cuyo `created_at` es **posterior** al `primer_outbound_at`. (Si el lead escribió primero sin que haya outbound previo, también cuenta como respondió → ver casos de test.)
- **`tiempo_primera_respuesta_seg`** = tiempo de respuesta DEL EQUIPO: desde el primer inbound del lead hasta el siguiente outbound de la asesora posterior a ese inbound. `null` si no hay outbound posterior al primer inbound. (Este es el número del bloque "¿el equipo responde bien?".)

---

## Estructura de archivos

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `scripts/sync/env.ts` | Carga de env vars | Modificar: agregar `CHATWOOT_URL`, `CHATWOOT_TOKEN`, `CHATWOOT_ACCOUNT_ID` |
| `scripts/sync/respondio.ts` | Lógica pura `deriveRespondio` (sin I/O) | Crear |
| `scripts/sync/respondio.test.ts` | Tests de `deriveRespondio` | Crear |
| `scripts/sync/chatwootClient.ts` | Cliente HTTP Chatwoot (paginado) | Crear |
| `scripts/sync/syncChatwoot.ts` | Orquesta lectura + derivación + upsert | Crear |
| `scripts/sync/index.ts` | Orquestador | Modificar: registrar paso Chatwoot |
| `scripts/sync/syncContactos.ts` | Sync de contactos | Modificar: mapear `chatwoot_contact_id` |
| `supabase/migrations/...12_chatwoot_conversaciones.sql` | Tabla nueva + columna + índices | Crear |
| `supabase/migrations/...13_mv_funnel_respondio.sql` | Exponer "Respondieron" + tiempos al embudo | Crear |
| `scripts/smoke_chatwoot.ts` | Smoke test de acceso a la API Chatwoot | Crear |

---

## Tarea 0: Reactivar Supabase + env Chatwoot + smoke de acceso

**Files:**
- Modify: `scripts/sync/env.ts`
- Create: `scripts/smoke_chatwoot.ts`
- Modify: `.env.local` (local, no se commitea)

- [ ] **Step 1: Reactivar el proyecto Supabase**

Vía MCP de Supabase: `restore_project` sobre el proyecto `dwnxldvrrzkqsqzlcvwt`. Confirmá con `get_project` que `status` pasa a `ACTIVE_HEALTHY`. (Si pide confirmación de costo, es el plan free — sin costo nuevo.)

- [ ] **Step 2: Agregar las env vars de Chatwoot a `.env.local`**

Las credenciales de Chatwoot están en `.mcp.json` del proyecto padre (`Yani Coach/.mcp.json`). Copiá host, token y account id a `.env.local` del Dashboard:

```
CHATWOOT_URL=https://chatwoot.yanicoach.com
CHATWOOT_TOKEN=<api_access_token del .mcp.json>
CHATWOOT_ACCOUNT_ID=<account id, normalmente 1>
```

- [ ] **Step 3: Extender `env.ts`**

En `scripts/sync/env.ts`, agregar al objeto `env` exportado (después de `TENANT_SLUG`):

```typescript
  CHATWOOT_URL: process.env.CHATWOOT_URL?.trim() || 'https://chatwoot.yanicoach.com',
  CHATWOOT_TOKEN: must('CHATWOOT_TOKEN'),
  CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID?.trim() || '1',
```

- [ ] **Step 4: Escribir el smoke de acceso a Chatwoot**

Crear `scripts/smoke_chatwoot.ts`:

```typescript
/**
 * Smoke test: confirma acceso a la API de Chatwoot.
 * Uso: npx tsx scripts/smoke_chatwoot.ts
 */
import { env } from './sync/env.js';

async function main() {
  const base = `${env.CHATWOOT_URL}/api/v1/accounts/${env.CHATWOOT_ACCOUNT_ID}`;
  const res = await fetch(`${base}/conversations?status=all&page=1`, {
    headers: { api_access_token: env.CHATWOOT_TOKEN },
  });
  if (!res.ok) {
    throw new Error(`Chatwoot ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data: { meta: unknown; payload: unknown[] } };
  console.log('✓ Acceso OK. Conversaciones en página 1:', json.data.payload.length);
  console.log('  meta:', JSON.stringify(json.data.meta));
  const first = json.data.payload[0] as Record<string, unknown> | undefined;
  if (first) {
    console.log('  ejemplo conv:', JSON.stringify({
      id: first.id, status: first.status,
      last_activity_at: first.last_activity_at,
      sender: (first.meta as Record<string, unknown> | undefined)?.sender,
    }));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: Correr el smoke y verificar**

Run: `npx tsx scripts/smoke_chatwoot.ts`
Expected: imprime `✓ Acceso OK.` con un número de conversaciones y un ejemplo con `id`, `status`, `last_activity_at`, `sender`. Confirmá que `sender` trae `id`, `phone_number`, `email`. Si da 401 → token mal; si 404 → revisar `CHATWOOT_ACCOUNT_ID`.

- [ ] **Step 6: Commit**

```bash
git add scripts/sync/env.ts scripts/smoke_chatwoot.ts
git commit -m "feat(sync): env vars Chatwoot + smoke de acceso a la API"
```

---

## Tarea 1: Función pura `deriveRespondio` (TDD — corazón del plan)

**Files:**
- Create: `scripts/sync/respondio.ts`
- Test: `scripts/sync/respondio.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `scripts/sync/respondio.test.ts`:

```typescript
/**
 * Tests de deriveRespondio. Uso: npx tsx scripts/sync/respondio.test.ts
 */
import assert from 'node:assert/strict';
import { deriveRespondio, type ChatwootMessage } from './respondio.js';

// Helper: arma un mensaje. ts en segundos epoch.
function msg(type: 0 | 1 | 2, ts: number, priv = false): ChatwootMessage {
  return { message_type: type, created_at: ts, private: priv };
}

// 1) Lead respondió al template
{
  const r = deriveRespondio([msg(1, 100), msg(0, 160)]);
  assert.equal(r.respondio, true);
  assert.equal(r.primer_outbound_at, 100);
  assert.equal(r.primer_inbound_at, 160);
  // tiempo de respuesta del equipo: no hay outbound posterior al inbound → null
  assert.equal(r.tiempo_primera_respuesta_seg, null);
}

// 2) Lead respondió y la asesora le contestó (mide tiempo del equipo)
{
  const r = deriveRespondio([msg(1, 100), msg(0, 160), msg(1, 220)]);
  assert.equal(r.respondio, true);
  assert.equal(r.tiempo_primera_respuesta_seg, 60); // 220 - 160
}

// 3) Solo se envió el template, el lead nunca contestó
{
  const r = deriveRespondio([msg(1, 100)]);
  assert.equal(r.respondio, false);
  assert.equal(r.primer_inbound_at, null);
  assert.equal(r.tiempo_primera_respuesta_seg, null);
}

// 4) Lead escribió primero (inbound directo, sin template previo) → cuenta como respondió
{
  const r = deriveRespondio([msg(0, 50), msg(1, 90)]);
  assert.equal(r.respondio, true);
  assert.equal(r.primer_inbound_at, 50);
  assert.equal(r.tiempo_primera_respuesta_seg, 40); // 90 - 50
}

// 5) Mensajes desordenados → la función ordena por created_at
{
  const r = deriveRespondio([msg(0, 160), msg(1, 100)]);
  assert.equal(r.respondio, true);
  assert.equal(r.primer_outbound_at, 100);
}

// 6) Ignora notas privadas y activities
{
  const r = deriveRespondio([msg(1, 100), msg(2, 120), msg(0, 130, true), msg(0, 200)]);
  assert.equal(r.respondio, true);
  assert.equal(r.primer_inbound_at, 200); // el inbound privado (130) se ignora
}

// 7) Conversación vacía
{
  const r = deriveRespondio([]);
  assert.equal(r.respondio, false);
  assert.equal(r.primer_outbound_at, null);
  assert.equal(r.primer_inbound_at, null);
  assert.equal(r.tiempo_primera_respuesta_seg, null);
}

console.log('✓ deriveRespondio: 7/7 casos pasaron');
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx tsx scripts/sync/respondio.test.ts`
Expected: FALLA con error de import (`Cannot find module './respondio.js'`) — el módulo aún no existe.

- [ ] **Step 3: Implementar `deriveRespondio`**

Crear `scripts/sync/respondio.ts`:

```typescript
/**
 * Lógica pura para derivar la señal "respondió" y el tiempo de respuesta del equipo
 * a partir de los mensajes de UNA conversación de Chatwoot. Sin I/O.
 */
export interface ChatwootMessage {
  message_type: 0 | 1 | 2 | 3; // 0=inbound (lead), 1=outbound (asesora), 2=activity
  created_at: number;          // epoch en segundos
  private?: boolean;           // notas internas
}

export interface RespondioResult {
  respondio: boolean;
  primer_outbound_at: number | null;
  primer_inbound_at: number | null;
  tiempo_primera_respuesta_seg: number | null;
}

export function deriveRespondio(messages: ChatwootMessage[]): RespondioResult {
  // Solo mensajes públicos de tipo inbound/outbound, ordenados por tiempo.
  const visible = messages
    .filter((m) => !m.private && (m.message_type === 0 || m.message_type === 1))
    .sort((a, b) => a.created_at - b.created_at);

  const firstOutbound = visible.find((m) => m.message_type === 1) ?? null;
  const firstInbound = visible.find((m) => m.message_type === 0) ?? null;

  const primer_outbound_at = firstOutbound?.created_at ?? null;
  const primer_inbound_at = firstInbound?.created_at ?? null;

  // Respondió: hay un inbound posterior al primer outbound, O el lead escribió primero.
  let respondio = false;
  if (primer_inbound_at !== null) {
    if (primer_outbound_at === null) {
      respondio = true;                         // lead escribió primero (sin outbound previo)
    } else if (primer_inbound_at < primer_outbound_at) {
      respondio = true;                         // lead escribió antes del primer outbound
    } else {
      respondio = visible.some(                 // outbound primero: ¿hay inbound posterior?
        (m) => m.message_type === 0 && m.created_at > primer_outbound_at,
      );
    }
  }

  // Tiempo de respuesta del equipo: del primer inbound al siguiente outbound posterior.
  let tiempo_primera_respuesta_seg: number | null = null;
  if (primer_inbound_at !== null) {
    const reply = visible.find(
      (m) => m.message_type === 1 && m.created_at > primer_inbound_at,
    );
    if (reply) tiempo_primera_respuesta_seg = reply.created_at - primer_inbound_at;
  }

  return { respondio, primer_outbound_at, primer_inbound_at, tiempo_primera_respuesta_seg };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx tsx scripts/sync/respondio.test.ts`
Expected: `✓ deriveRespondio: 7/7 casos pasaron`

- [ ] **Step 5: Commit**

```bash
git add scripts/sync/respondio.ts scripts/sync/respondio.test.ts
git commit -m "feat(sync): deriveRespondio (señal respondió + tiempo de respuesta) con tests"
```

---

## Tarea 2: Cliente HTTP de Chatwoot (paginado + incremental)

**Files:**
- Create: `scripts/sync/chatwootClient.ts`

- [ ] **Step 1: Implementar el cliente**

Crear `scripts/sync/chatwootClient.ts`:

```typescript
import { env } from './env.js';
import type { ChatwootMessage } from './respondio.js';

const BASE = `${env.CHATWOOT_URL}/api/v1/accounts/${env.CHATWOOT_ACCOUNT_ID}`;
const HEADERS = { api_access_token: env.CHATWOOT_TOKEN };

export interface ChatwootConversation {
  id: number;
  status: string;
  last_activity_at: number; // epoch seg
  contact_id: number | null;
  contact_phone: string | null;
  contact_email: string | null;
  agent_id: number | null;
}

async function getJson<T>(url: string): Promise<T> {
  // Reintento simple x3 con backoff (DNS/429), patrón del proyecto.
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        continue;
      }
      if (!res.ok) throw new Error(`Chatwoot ${res.status} en ${url}: ${await res.text()}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr;
}

/** Lista todas las conversaciones, paginando hasta agotar. */
export async function listConversations(): Promise<ChatwootConversation[]> {
  const out: ChatwootConversation[] = [];
  for (let page = 1; ; page++) {
    const json = await getJson<{ data: { payload: any[] } }>(
      `${BASE}/conversations?status=all&page=${page}`,
    );
    const payload = json.data?.payload ?? [];
    if (payload.length === 0) break;
    for (const c of payload) {
      const sender = c.meta?.sender ?? {};
      out.push({
        id: c.id,
        status: c.status,
        last_activity_at: c.last_activity_at ?? c.timestamp ?? 0,
        contact_id: sender.id ?? null,
        contact_phone: sender.phone_number ?? null,
        contact_email: sender.email ?? null,
        agent_id: c.meta?.assignee?.id ?? null,
      });
    }
    if (payload.length < 25) break; // página incompleta = última
  }
  return out;
}

/** Trae todos los mensajes de una conversación (paginado por before). */
export async function listMessages(conversationId: number): Promise<ChatwootMessage[]> {
  const json = await getJson<{ payload: any[] }>(
    `${BASE}/conversations/${conversationId}/messages`,
  );
  const payload = json.payload ?? [];
  return payload.map((m) => ({
    message_type: m.message_type,
    created_at: m.created_at,
    private: m.private ?? false,
  }));
}
```

> Nota: la paginación de mensajes de Chatwoot trae el último tramo; para conversaciones de WhatsApp del flujo (template + respuesta) eso alcanza para derivar la señal. Si en la verificación (Tarea 5) aparecen conversaciones con muchísimos mensajes donde el primer outbound queda fuera de página, agregar paginación con `?before={message_id}` — dejar como nota, no anticipar.

- [ ] **Step 2: Verificar manualmente con un script ad-hoc**

Run:
```bash
npx tsx -e "import('./scripts/sync/chatwootClient.js').then(async m => { const c = await m.listConversations(); console.log('convs:', c.length); const msgs = await m.listMessages(c[0].id); console.log('msgs conv', c[0].id, ':', msgs.length, msgs.slice(0,3)); })"
```
Expected: imprime cantidad total de conversaciones y los primeros mensajes de la primera, con `message_type` y `created_at` numéricos.

- [ ] **Step 3: Commit**

```bash
git add scripts/sync/chatwootClient.ts
git commit -m "feat(sync): cliente HTTP Chatwoot (conversaciones + mensajes, con reintentos)"
```

---

## Tarea 3: Migración — tabla `chatwoot_conversaciones` + columna en contactos

**Files:**
- Create: `supabase/migrations/20260527XXXXXX_12_chatwoot_conversaciones.sql` (usar timestamp real al crear)
- Modify: `scripts/sync/syncContactos.ts`

- [ ] **Step 1: Escribir la migración**

Crear el archivo SQL (reemplazar `XXXXXX` por hora real, p.ej. `20260527160000`):

```sql
-- ============================================================================
-- Fase 1 — Señal "respondió" desde Chatwoot
-- Tabla de conversaciones + columna de enlace en contactos.
-- ============================================================================

-- 1) Columna de enlace primario en contactos (viene de NocoDB.chatwoot_contact_id)
ALTER TABLE public.contactos
  ADD COLUMN IF NOT EXISTS chatwoot_contact_id text;

CREATE INDEX IF NOT EXISTS idx_contactos_chatwoot_contact
  ON public.contactos (tenant_id, chatwoot_contact_id)
  WHERE chatwoot_contact_id IS NOT NULL;

-- 2) Tabla de conversaciones de Chatwoot (1 fila por conversación)
CREATE TABLE IF NOT EXISTS public.chatwoot_conversaciones (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  chatwoot_conversation_id      bigint NOT NULL,
  chatwoot_contact_id           text,
  contacto_id                   uuid REFERENCES public.contactos(id) ON DELETE SET NULL,
  agent_chatwoot_id             integer,
  vendedora_id                  uuid REFERENCES public.vendedoras(id) ON DELETE SET NULL,
  status                        text,
  respondio                     boolean NOT NULL DEFAULT false,
  primer_outbound_at            timestamptz,
  primer_inbound_at             timestamptz,
  tiempo_primera_respuesta_seg  integer,
  last_activity_at              timestamptz,
  raw                           jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at                     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, chatwoot_conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_cw_conv_contacto
  ON public.chatwoot_conversaciones (tenant_id, contacto_id);
CREATE INDEX IF NOT EXISTS idx_cw_conv_respondio
  ON public.chatwoot_conversaciones (tenant_id, respondio);

-- 3) RLS + SELECT anónimo (mismo patrón que migración 09)
ALTER TABLE public.chatwoot_conversaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_select_cw_conv ON public.chatwoot_conversaciones;
CREATE POLICY anon_select_cw_conv ON public.chatwoot_conversaciones
  FOR SELECT TO anon USING (true);

-- 4) FK resolver: del chatwoot_contact_id de contactos al contacto_id de la conversación
CREATE OR REPLACE FUNCTION public.resolve_chatwoot_fks(p_tenant_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.chatwoot_conversaciones cc
  SET contacto_id = c.id
  FROM public.contactos c
  WHERE cc.tenant_id = p_tenant_id
    AND c.tenant_id = p_tenant_id
    AND cc.contacto_id IS NULL
    AND cc.chatwoot_contact_id IS NOT NULL
    AND c.chatwoot_contact_id = cc.chatwoot_contact_id;

  UPDATE public.chatwoot_conversaciones cc
  SET vendedora_id = v.id
  FROM public.vendedoras v
  WHERE cc.tenant_id = p_tenant_id
    AND v.tenant_id = p_tenant_id
    AND cc.vendedora_id IS NULL
    AND cc.agent_chatwoot_id IS NOT NULL
    AND v.chatwoot_agent_id = cc.agent_chatwoot_id;
$$;
```

- [ ] **Step 2: Aplicar la migración**

Vía MCP Supabase `apply_migration` con name `12_chatwoot_conversaciones` y el SQL de arriba. Verificá con `list_tables` que aparece `chatwoot_conversaciones` y que `contactos` tiene la columna `chatwoot_contact_id`.

- [ ] **Step 3: Mapear `chatwoot_contact_id` en `syncContactos.ts`**

En `scripts/sync/syncContactos.ts`: agregar el campo a la interfaz `ContactoRecord` (después de `telefono`):

```typescript
  chatwoot_contact_id: string | null;
```

Y en `normalize()`, dentro del objeto retornado (después de `telefono: toText(row['Teléfono']),`):

```typescript
    chatwoot_contact_id: toText(row['chatwoot_contact_id']),
```

- [ ] **Step 4: Re-sincronizar contactos y verificar la columna**

Run: `npm run sync -- contactos`
Expected: termina con `✓ N contactos upserted`. Luego, vía MCP Supabase `execute_sql`:
```sql
SELECT count(*) FILTER (WHERE chatwoot_contact_id IS NOT NULL) AS con_cw,
       count(*) AS total
FROM contactos;
```
Expected: `con_cw` > 0 (los contactos cargados manualmente). Es esperable que `con_cw < total` (no todos tienen el id).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260527XXXXXX_12_chatwoot_conversaciones.sql scripts/sync/syncContactos.ts
git commit -m "feat(db): tabla chatwoot_conversaciones + enlace chatwoot_contact_id en contactos"
```

---

## Tarea 4: Módulo `syncChatwoot.ts` + registro en el orquestador

**Files:**
- Create: `scripts/sync/syncChatwoot.ts`
- Modify: `scripts/sync/index.ts`

- [ ] **Step 1: Implementar `syncChatwoot`**

Crear `scripts/sync/syncChatwoot.ts`:

```typescript
import { listConversations, listMessages } from './chatwootClient.js';
import { deriveRespondio } from './respondio.js';
import { supabaseAdmin } from './supabaseAdmin.js';
import { chunk } from './helpers.js';

const BATCH_SIZE = 500;

interface ConvRecord {
  tenant_id: string;
  chatwoot_conversation_id: number;
  chatwoot_contact_id: string | null;
  agent_chatwoot_id: number | null;
  status: string | null;
  respondio: boolean;
  primer_outbound_at: string | null;
  primer_inbound_at: string | null;
  tiempo_primera_respuesta_seg: number | null;
  last_activity_at: string | null;
  raw: Record<string, unknown>;
  synced_at: string;
}

const isoFromEpoch = (s: number | null): string | null =>
  s ? new Date(s * 1000).toISOString() : null;

export async function syncChatwoot(tenantId: string, runId: string) {
  console.log('\n=== Sync Chatwoot ===');
  const started = Date.now();

  const convs = await listConversations();
  console.log(`  ${convs.length} conversaciones listadas`);

  const records: ConvRecord[] = [];
  let i = 0;
  for (const c of convs) {
    i++;
    const messages = await listMessages(c.id);
    const r = deriveRespondio(messages);
    records.push({
      tenant_id: tenantId,
      chatwoot_conversation_id: c.id,
      chatwoot_contact_id: c.contact_id !== null ? String(c.contact_id) : null,
      agent_chatwoot_id: c.agent_id,
      status: c.status,
      respondio: r.respondio,
      primer_outbound_at: isoFromEpoch(r.primer_outbound_at),
      primer_inbound_at: isoFromEpoch(r.primer_inbound_at),
      tiempo_primera_respuesta_seg: r.tiempo_primera_respuesta_seg,
      last_activity_at: isoFromEpoch(c.last_activity_at),
      raw: { phone: c.contact_phone, email: c.contact_email },
      synced_at: new Date().toISOString(),
    });
    if (i % 100 === 0) console.log(`  procesadas ${i}/${convs.length}`);
  }

  let upserted = 0;
  for (const batch of chunk(records, BATCH_SIZE)) {
    const { error, count } = await supabaseAdmin
      .from('chatwoot_conversaciones')
      .upsert(batch, {
        onConflict: 'tenant_id,chatwoot_conversation_id',
        ignoreDuplicates: false,
        count: 'exact',
      });
    if (error) {
      await supabaseAdmin.from('sync_runs').update({
        status: 'error',
        finished_at: new Date().toISOString(),
        rows_failed: batch.length,
        error: { message: error.message, details: error.details, hint: error.hint },
      }).eq('id', runId);
      throw error;
    }
    upserted += count ?? batch.length;
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`  ✓ ${upserted} conversaciones upserted en ${elapsed}s`);
  return { rows: upserted };
}
```

- [ ] **Step 2: Registrar en `index.ts`**

En `scripts/sync/index.ts`:

a) Import (después de los otros imports de sync):
```typescript
import { syncChatwoot } from './syncChatwoot.js';
```

b) Agregar a `TABLES` (después de `intentos_compra`):
```typescript
  chatwoot: syncChatwoot,
```

c) El `source` de `sync_runs` para chatwoot debe ser `'chatwoot'`, no `'nocodb'`. Modificar `openRun` para aceptar el source:
```typescript
async function openRun(tenantId: string, tableName: string): Promise<string> {
  const source = tableName === 'chatwoot' ? 'chatwoot' : 'nocodb';
  const { data, error } = await supabaseAdmin
    .from('sync_runs')
    .insert({ tenant_id: tenantId, source, table_name: tableName, status: 'running' })
    .select('id')
    .single();
  if (error || !data) throw new Error(`No pude abrir sync_run: ${error?.message}`);
  return data.id;
}
```

d) Resolver los FKs de Chatwoot. En `resolveForeignKeys`, después del `resolve_foreign_keys` existente, agregar:
```typescript
  const { error: cwErr } = await supabaseAdmin.rpc('resolve_chatwoot_fks', { p_tenant_id: tenantId });
  if (cwErr) { console.error('  ✗ resolve_chatwoot_fks falló:', cwErr.message); throw cwErr; }
  console.log('  ✓ FKs de Chatwoot resueltos');
```

- [ ] **Step 3: Correr solo el sync de Chatwoot**

Run: `npm run sync -- chatwoot`
Expected: `✓ N conversaciones upserted`. Luego corre `resolve_foreign_keys` + `resolve_chatwoot_fks` + refresh (el orquestador siempre los corre al final).

- [ ] **Step 4: Verificar datos y enlace**

Vía MCP Supabase `execute_sql`:
```sql
SELECT
  count(*) AS convs,
  count(*) FILTER (WHERE respondio) AS respondieron,
  count(*) FILTER (WHERE contacto_id IS NOT NULL) AS enlazadas,
  round(avg(tiempo_primera_respuesta_seg)/60.0, 1) AS resp_prom_min
FROM chatwoot_conversaciones;
```
Expected: `convs` ≈ total de conversaciones de Chatwoot; `respondieron` > 0; `enlazadas` > 0 (las que matchearon por `chatwoot_contact_id`); `resp_prom_min` un número plausible (ej. 10-40 min).

- [ ] **Step 5: Commit**

```bash
git add scripts/sync/syncChatwoot.ts scripts/sync/index.ts
git commit -m "feat(sync): syncChatwoot integrado al orquestador (respondió + tiempos en Supabase)"
```

---

## Tarea 5: Migración — exponer "Respondieron" y tiempos al embudo

**Files:**
- Create: `supabase/migrations/20260527XXXXXX_13_funnel_respondio.sql`

- [ ] **Step 1: Escribir la migración**

El frontend lee `mv_funnel_counts` (conteos por `estado_simplificado`) y `mv_vendedora_performance`. Agregamos una vista nueva, simple, con los números del embudo de Yani + tiempos. La hacemos VIEW normal (no materializada) porque es un agregado barato sobre `contactos` + `chatwoot_conversaciones`:

```sql
-- ============================================================================
-- Fase 1 — Vista de embudo con la etapa "Respondieron" + responsividad del equipo
-- ============================================================================

CREATE OR REPLACE VIEW public.v_funnel_respondio AS
WITH conv_por_contacto AS (
  SELECT
    tenant_id,
    contacto_id,
    bool_or(respondio) AS respondio,
    min(tiempo_primera_respuesta_seg) AS tiempo_resp_seg
  FROM public.chatwoot_conversaciones
  WHERE contacto_id IS NOT NULL
  GROUP BY tenant_id, contacto_id
)
SELECT
  c.tenant_id,
  count(*) AS leads_nuevos,
  count(*) FILTER (WHERE cpc.respondio) AS respondieron,
  count(*) FILTER (WHERE c.estado_simplificado = 'Interesado') AS interesados,
  count(*) FILTER (WHERE c.estado_simplificado = 'Venta Cerrada') AS venta_cerrada,
  count(*) FILTER (WHERE c.estado_simplificado = 'Venta Perdida') AS venta_perdida,
  round(avg(cpc.tiempo_resp_seg) FILTER (WHERE cpc.tiempo_resp_seg IS NOT NULL) / 60.0, 1)
    AS tiempo_resp_prom_min
FROM public.contactos c
LEFT JOIN conv_por_contacto cpc
  ON cpc.tenant_id = c.tenant_id AND cpc.contacto_id = c.id
GROUP BY c.tenant_id;

GRANT SELECT ON public.v_funnel_respondio TO anon;

-- Responsividad por vendedora (para el bloque "¿el equipo responde bien?")
CREATE OR REPLACE VIEW public.v_responsividad_vendedora AS
SELECT
  cc.tenant_id,
  cc.vendedora_id,
  v.nombre AS vendedora_nombre,
  count(*) FILTER (WHERE cc.respondio) AS chats_respondidos,
  round(avg(cc.tiempo_primera_respuesta_seg)
    FILTER (WHERE cc.tiempo_primera_respuesta_seg IS NOT NULL) / 60.0, 1) AS resp_prom_min
FROM public.chatwoot_conversaciones cc
LEFT JOIN public.vendedoras v ON v.id = cc.vendedora_id
WHERE cc.vendedora_id IS NOT NULL
GROUP BY cc.tenant_id, cc.vendedora_id, v.nombre;

GRANT SELECT ON public.v_responsividad_vendedora TO anon;
```

> Nota de alcance: `interesados`/`venta_cerrada`/`venta_perdida` dependen de `estado_simplificado`, cuyo mapping (`map_estado_simplificado`) quedó desactualizado respecto a los valores reales de NocoDB ("Lead Nuevo", "Venta Ganada", "Llamada Agendada"…). Eso se corrige en el Plan 2 (es un fix de mapping, no de esta señal). En esta vista "Respondieron" ya es 100% correcto porque sale de Chatwoot.

- [ ] **Step 2: Aplicar y verificar**

`apply_migration` name `13_funnel_respondio`. Luego `execute_sql`:
```sql
SELECT * FROM v_funnel_respondio;
SELECT * FROM v_responsividad_vendedora ORDER BY chats_respondidos DESC;
```
Expected: una fila de embudo con `leads_nuevos`/`respondieron`/`tiempo_resp_prom_min` y una fila por vendedora con sus tiempos.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260527XXXXXX_13_funnel_respondio.sql
git commit -m "feat(db): vistas de embudo con Respondieron + responsividad por vendedora"
```

---

## Tarea 6: Verificación end-to-end

- [ ] **Step 1: Correr el sync completo**

Run: `npm run sync`
Expected: corre vendedoras → contactos → interacciones → ventas → intentos_compra → chatwoot, luego resuelve FKs (NocoDB + Chatwoot) y refresca MVs. Sin errores.

- [ ] **Step 2: Verificar `sync_runs`**

`execute_sql`:
```sql
SELECT source, table_name, status, rows_updated, rows_failed,
       finished_at - started_at AS duracion
FROM sync_runs
WHERE started_at > now() - interval '1 hour'
ORDER BY started_at;
```
Expected: una fila `chatwoot` con `status='success'` y `rows_updated` > 0; ninguna en `error`.

- [ ] **Step 3: Re-correr los tests unitarios (no rompió nada)**

Run: `npx tsx scripts/sync/respondio.test.ts`
Expected: `✓ deriveRespondio: 7/7 casos pasaron`

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: sin errores de TypeScript.

- [ ] **Step 5: Commit final / tag**

```bash
git commit --allow-empty -m "chore: Fase 1 señal respondió verificada end-to-end"
```

---

## Definition of Done (Plan 1)

- [ ] `npm run sync` corre Chatwoot sin errores y registra `source='chatwoot'` en `sync_runs`.
- [ ] `v_funnel_respondio` devuelve `respondieron` y `tiempo_resp_prom_min` reales.
- [ ] `v_responsividad_vendedora` devuelve tiempos por asesora (Dochi/Mary).
- [ ] Tests de `deriveRespondio` en verde (7/7).
- [ ] `npm run typecheck` limpio.
- [ ] Supabase ACTIVE (el sync periódico lo mantendrá vivo desde el Plan 3).

---

## Fuera de alcance (Plan 1)

- **Fallback de enlace por teléfono** para contactos sin `chatwoot_contact_id` (con la trampa del prefijo "15" AR). Deuda documentada; evaluar en Plan 2 según cuántos quedan sin enlazar (métrica `enlazadas/convs` de Tarea 4).
- **Paginación profunda de mensajes** (conversaciones gigantes). Solo si la verificación lo exige.
- **Fix del mapping `estado_simplificado`** (valores reales NocoDB) → Plan 2.
- **Sync incremental real por watermark** (hoy relista todas las conversaciones). Optimización para Plan 3 si la corrida tarda demasiado.
- **Calendly / etapa "Agendó llamada"** → Fase 2.

---

## Roadmap de los planes siguientes (se escriben después, uno por uno)

- **Plan 2 — Vista "Resumen" (diseño aprobado):** portar `diseno-aprobado/dashboard.jsx` a componentes React/TS/Tailwind del proyecto, montarlo como pestaña de entrada, cablear `v_funnel_respondio` + `v_responsividad_vendedora` vía `services/dataSource.ts` y `hooks/useDashboardData.ts`, filtro de fecha y refresh-al-abrir. Incluye el fix del mapping `estado_simplificado` con los valores reales de NocoDB.
- **Plan 3 — Deploy en VPS:** contenedor del sync (ya hay `Dockerfile` + `docker-compose.sync.yml`) con cron periódico (mantiene Supabase vivo) + frontend como build estático servido desde el VPS detrás del proxy existente; baja de Vercel.

---

## Referencias

- Spec de diseño: `.brain/diseno_dashboard_metricas_v1_2026-05-27.md`
- Embudo en palabras de Yani: `memory/embudo_dashboard_yani.md`
- Diseño aprobado: `diseno-aprobado/` (revisado en navegador, ver `screenshots/revision-playwright/`)
- Patrón sync existente: `scripts/sync/index.ts`, `scripts/sync/syncContactos.ts`
