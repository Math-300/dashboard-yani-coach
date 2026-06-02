# Plantillas (día a día) + Tiempo de respuesta humano — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Medir el tiempo de respuesta HUMANO real de las asesoras (excluyendo templates y la cuenta automática) y agregar una sección "Plantillas" con envíos, tasa de entrega, apertura y respuesta de los templates del día a día (masivos excluidos).

**Architecture:** Se extiende el pipeline existente Chatwoot/NocoDB → Supabase → dashboard. El sync baja por mensaje campos nuevos de Chatwoot (status, is_template_replay, template_name, sender, id), corrige la derivación del tiempo de respuesta, y llena dos tablas nuevas (`plantillas_catalogo`, `plantillas_envios`). Un RPC fechado `get_plantillas_stats` agrega por template; una vista React nueva lo muestra respetando el filtro de fechas.

**Tech Stack:** TypeScript, tsx (sync + tests con `node:assert`), Supabase Postgres (migraciones SQL), React 19 + Vite, Docker Swarm en VPS.

**Spec:** `docs/superpowers/specs/2026-06-02-plantillas-y-respuesta-humana-design.md`

---

## File Structure

**Sync (scripts/sync/):**
- `respondio.ts` (MOD) — enriquecer `ChatwootMessage`; tiempo de respuesta humano en `deriveRespondio`; nueva función pura `deriveTemplateSends`.
- `respondio.test.ts` (MOD) — casos nuevos para respuesta humana + template sends.
- `chatwootClient.ts` (MOD) — `listMessages` mapea los campos nuevos.
- `env.ts` (MOD) — constante `TABLE_TEMPLATES`.
- `syncPlantillas.ts` (NEW) — espejo del catálogo `Templates_Outbound` → `plantillas_catalogo`, derivando `es_masivo`.
- `syncChatwoot.ts` (MOD) — lee el set de masivos desde `plantillas_catalogo`; por cada conversación deriva template sends y los upserta en `plantillas_envios`.
- `index.ts` (MOD) — registra `plantillas` antes de `chatwoot` en el orquestador.

**DB (supabase/migrations/):**
- `20260602160000_18_plantillas_tablas.sql` (NEW) — tablas `plantillas_catalogo` + `plantillas_envios` + índices + RLS.
- `20260602170000_19_get_plantillas_stats.sql` (NEW) — RPC agregador fechado.

**Frontend:**
- `services/types.ts` (MOD) — `PlantillaStatRow`.
- `services/dataSource.ts` (MOD) — `getPlantillasStats`.
- `services/cacheService.ts` (MOD) — `plantillas` en `CachedData` + carga.
- `hooks/useDashboardData.ts` (MOD) — estado + retorno `plantillas`.
- `components/yc/Sidebar.tsx` (MOD) — `SectionId` += `'plantillas'`; item navegable.
- `App.tsx` (MOD) — consumir `plantillas` y montar `PlantillasView` en la sección.
- `components/views/PlantillasView.tsx` (NEW) — la vista.

**Deploy:** rebuild + redeploy de imágenes web y sync; aplicar migraciones; correr sync; verificar en vivo.

---

## Task 1: Enriquecer ChatwootMessage y listMessages

**Files:**
- Modify: `scripts/sync/respondio.ts` (interface `ChatwootMessage`)
- Modify: `scripts/sync/chatwootClient.ts` (`listMessages`)

Campos nuevos son OPCIONALES para no romper los tests existentes de `deriveRespondio`.

- [ ] **Step 1: Extender la interface `ChatwootMessage`**

En `scripts/sync/respondio.ts`, reemplazar la interface por:

```ts
export interface ChatwootMessage {
  message_type: 0 | 1 | 2 | 3; // 0=inbound (lead), 1=outbound (asesora/auto), 2=activity
  created_at: number;          // epoch en segundos
  private?: boolean;           // notas internas
  id?: number;                 // id del mensaje (idempotencia de plantillas_envios)
  status?: string | null;      // sent | delivered | read | failed
  is_template_replay?: boolean;// true si es un template de WhatsApp
  template_name?: string | null;
  sender_name?: string | null; // nombre del emisor (para excluir cuenta automática)
}
```

- [ ] **Step 2: Mapear los campos nuevos en `listMessages`**

En `scripts/sync/chatwootClient.ts`, reemplazar el `.map` dentro de `listMessages` por:

```ts
  return payload.map((m) => {
    const ca = m.content_attributes ?? {};
    return {
      message_type: m.message_type,
      created_at: m.created_at,
      private: m.private ?? false,
      id: m.id ?? null,
      status: m.status ?? null,
      is_template_replay: ca.is_template_replay === true,
      template_name: ca.template_name ?? null,
      sender_name: m.sender?.name ?? null,
    };
  });
```

- [ ] **Step 3: Typecheck**

Run: `cd "Dashboard Yani Coach" && npm run typecheck`
Expected: PASS (sin errores).

- [ ] **Step 4: Commit**

```bash
git add scripts/sync/respondio.ts scripts/sync/chatwootClient.ts
git commit -m "feat(sync): capturar status/template/sender/id por mensaje de Chatwoot"
```

---

## Task 2: Tiempo de respuesta humano en deriveRespondio (TDD)

**Files:**
- Modify: `scripts/sync/respondio.ts` (`deriveRespondio`)
- Test: `scripts/sync/respondio.test.ts`

La "respuesta de la asesora" = primer outbound posterior al inbound que NO sea template y NO sea de la cuenta automática.

- [ ] **Step 1: Agregar tests que fallan**

En `scripts/sync/respondio.test.ts`, actualizar el helper `msg` y agregar casos al final (antes del `console.log`):

```ts
// helper extendido (reemplaza el msg() existente)
function msg(
  type: 0 | 1 | 2,
  ts: number,
  priv = false,
  extra: Partial<ChatwootMessage> = {},
): ChatwootMessage {
  return { message_type: type, created_at: ts, private: priv, ...extra };
}

// 8) El primer outbound es un template → NO cuenta como respuesta humana
{
  const r = deriveRespondio([
    msg(0, 100),
    msg(1, 110, false, { is_template_replay: true, template_name: 'bienvenida_plataforma_v2' }),
    msg(1, 400, false, { sender_name: 'María del Carmen Vera' }),
  ]);
  assert.equal(r.respondio, true);
  assert.equal(r.tiempo_primera_respuesta_seg, 300); // 400-100, ignora el template a los 110
}

// 9) El outbound rápido es de la cuenta automática → NO cuenta
{
  const r = deriveRespondio([
    msg(0, 100),
    msg(1, 102, false, { sender_name: 'Yanina Zapino' }),
    msg(1, 700, false, { sender_name: 'María Beatriz Juzviachik' }),
  ]);
  assert.equal(r.tiempo_primera_respuesta_seg, 600); // 700-100, ignora el auto a los 102
}

// 10) Solo hay respuesta automática → tiempo humano null
{
  const r = deriveRespondio([
    msg(0, 100),
    msg(1, 105, false, { is_template_replay: true, template_name: 'revision_perfil_ig' }),
  ]);
  assert.equal(r.respondio, false); // el lead no escribió después
  assert.equal(r.tiempo_primera_respuesta_seg, null);
}

// 11) automationSenders configurable
{
  const r = deriveRespondio(
    [msg(0, 100), msg(1, 150, false, { sender_name: 'Bot X' })],
    { automationSenders: new Set(['Bot X']) },
  );
  assert.equal(r.tiempo_primera_respuesta_seg, null);
}
```

Y asegurar que el import incluya el tipo:
```ts
import { deriveRespondio, type ChatwootMessage } from './respondio.js';
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd "Dashboard Yani Coach" && npx tsx scripts/sync/respondio.test.ts`
Expected: FAIL (AssertionError en el caso 8: tiempo 10 en vez de 300, porque hoy cuenta el template).

- [ ] **Step 3: Implementar la lógica humana**

En `scripts/sync/respondio.ts`, agregar arriba de `deriveRespondio`:

```ts
export interface DeriveOptions {
  /** Nombres de cuentas automáticas a excluir como "respuesta humana". */
  automationSenders?: Set<string>;
}

const DEFAULT_AUTOMATION_SENDERS = new Set(['Yanina Zapino']);
```

Cambiar la firma y el bloque de cálculo de `tiempo_primera_respuesta_seg`:

```ts
export function deriveRespondio(
  messages: ChatwootMessage[],
  opts: DeriveOptions = {},
): RespondioResult {
  const automation = opts.automationSenders ?? DEFAULT_AUTOMATION_SENDERS;

  const visible = messages
    .filter((m) => !m.private && (m.message_type === 0 || m.message_type === 1))
    .sort((a, b) => a.created_at - b.created_at);

  const firstOutbound = visible.find((m) => m.message_type === 1) ?? null;
  const firstInbound = visible.find((m) => m.message_type === 0) ?? null;

  const primer_outbound_at = firstOutbound?.created_at ?? null;
  const primer_inbound_at = firstInbound?.created_at ?? null;

  let respondio = false;
  if (primer_inbound_at !== null) {
    if (primer_outbound_at === null) {
      respondio = true;
    } else if (primer_inbound_at < primer_outbound_at) {
      respondio = true;
    } else {
      respondio = visible.some(
        (m) => m.message_type === 0 && m.created_at > primer_outbound_at,
      );
    }
  }

  // Tiempo de respuesta HUMANO: primer outbound posterior al inbound que NO sea
  // template ni de una cuenta automática. Si no existe → null (honesto).
  let tiempo_primera_respuesta_seg: number | null = null;
  if (primer_inbound_at !== null) {
    const humanReply = visible.find(
      (m) =>
        m.message_type === 1 &&
        m.created_at > primer_inbound_at &&
        m.is_template_replay !== true &&
        !(m.sender_name != null && automation.has(m.sender_name)),
    );
    if (humanReply) {
      tiempo_primera_respuesta_seg = humanReply.created_at - primer_inbound_at;
    }
  }

  return { respondio, primer_outbound_at, primer_inbound_at, tiempo_primera_respuesta_seg };
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd "Dashboard Yani Coach" && npx tsx scripts/sync/respondio.test.ts`
Expected: PASS — los 7 originales + los 4 nuevos. Salida termina en un `console.log` de éxito.

- [ ] **Step 5: Actualizar el mensaje de éxito del test**

En `scripts/sync/respondio.test.ts`, cambiar la última línea a:
```ts
console.log('✓ deriveRespondio: 11/11 casos pasaron');
```

- [ ] **Step 6: Commit**

```bash
git add scripts/sync/respondio.ts scripts/sync/respondio.test.ts
git commit -m "feat(sync): tiempo de respuesta humano (excluye templates y cuenta automatica)"
```

---

## Task 3: Función pura deriveTemplateSends (TDD)

**Files:**
- Modify: `scripts/sync/respondio.ts` (nueva función + tipo)
- Test: `scripts/sync/plantillas.test.ts` (NEW)

Extrae los envíos de template de UNA conversación. Sin I/O. `es_masivo` y `contacto_nocodb_id` se agregan después (necesitan contexto de conversación), no acá.

- [ ] **Step 1: Escribir el test que falla**

Crear `scripts/sync/plantillas.test.ts`:

```ts
/**
 * Tests de deriveTemplateSends. Uso: npx tsx scripts/sync/plantillas.test.ts
 */
import assert from 'node:assert/strict';
import { deriveTemplateSends, type ChatwootMessage } from './respondio.js';

function m(extra: Partial<ChatwootMessage> & { message_type: 0 | 1 | 2; created_at: number }): ChatwootMessage {
  return { private: false, ...extra };
}

// 1) Un template leído, con respuesta posterior del lead
{
  const sends = deriveTemplateSends([
    m({ message_type: 1, created_at: 100, id: 11, status: 'read', is_template_replay: true, template_name: 'bienvenida_plataforma_v2' }),
    m({ message_type: 0, created_at: 200, id: 12 }),
  ]);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].chatwoot_message_id, 11);
  assert.equal(sends[0].template_name, 'bienvenida_plataforma_v2');
  assert.equal(sends[0].enviado_at, 100);
  assert.equal(sends[0].leido, true);
  assert.equal(sends[0].entregado, true);
  assert.equal(sends[0].fallido, false);
  assert.equal(sends[0].respondido, true);
}

// 2) Template entregado (no leído), sin respuesta
{
  const sends = deriveTemplateSends([
    m({ message_type: 1, created_at: 100, id: 21, status: 'delivered', is_template_replay: true, template_name: 'revision_perfil_ig' }),
  ]);
  assert.equal(sends[0].entregado, true);
  assert.equal(sends[0].leido, false);
  assert.equal(sends[0].respondido, false);
}

// 3) Template fallido
{
  const sends = deriveTemplateSends([
    m({ message_type: 1, created_at: 100, id: 31, status: 'failed', is_template_replay: true, template_name: 'primer_contacto_yanicoach' }),
  ]);
  assert.equal(sends[0].fallido, true);
  assert.equal(sends[0].entregado, false);
}

// 4) Mensajes que NO son template (texto normal, inbound, sin id) → se ignoran
{
  const sends = deriveTemplateSends([
    m({ message_type: 1, created_at: 100, id: 41, status: 'read' }), // texto normal de asesora
    m({ message_type: 0, created_at: 110, id: 42 }),                 // inbound
    m({ message_type: 1, created_at: 120, status: 'read', is_template_replay: true, template_name: 'x' }), // sin id → se ignora
  ]);
  assert.equal(sends.length, 0);
}

// 5) Respuesta ANTERIOR al template no cuenta como respondido
{
  const sends = deriveTemplateSends([
    m({ message_type: 0, created_at: 50, id: 51 }),
    m({ message_type: 1, created_at: 100, id: 52, status: 'read', is_template_replay: true, template_name: 'y' }),
  ]);
  assert.equal(sends[0].respondido, false); // el inbound a los 50 es previo al envío
}

console.log('✓ deriveTemplateSends: 5/5 casos pasaron');
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd "Dashboard Yani Coach" && npx tsx scripts/sync/plantillas.test.ts`
Expected: FAIL ("deriveTemplateSends is not a function").

- [ ] **Step 3: Implementar la función**

En `scripts/sync/respondio.ts`, agregar al final:

```ts
export interface TemplateSend {
  chatwoot_message_id: number;
  template_name: string;
  enviado_at: number; // epoch sec
  status: string | null;
  entregado: boolean;
  leido: boolean;
  fallido: boolean;
  respondido: boolean;
}

/**
 * Extrae los envíos de template (is_template_replay) de una conversación.
 * `respondido` = hubo un inbound visible posterior al envío.
 * Función pura: es_masivo y contacto se agregan en el sync.
 */
export function deriveTemplateSends(messages: ChatwootMessage[]): TemplateSend[] {
  const sorted = [...messages].sort((a, b) => a.created_at - b.created_at);
  const inbounds = sorted.filter((m) => m.message_type === 0 && !m.private);
  const out: TemplateSend[] = [];
  for (const m of sorted) {
    if (m.message_type !== 1 || m.private) continue;
    if (m.is_template_replay !== true || !m.template_name || m.id == null) continue;
    const status = m.status ?? null;
    out.push({
      chatwoot_message_id: m.id,
      template_name: m.template_name,
      enviado_at: m.created_at,
      status,
      entregado: status === 'delivered' || status === 'read',
      leido: status === 'read',
      fallido: status === 'failed',
      respondido: inbounds.some((i) => i.created_at > m.created_at),
    });
  }
  return out;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd "Dashboard Yani Coach" && npx tsx scripts/sync/plantillas.test.ts`
Expected: PASS — `✓ deriveTemplateSends: 5/5 casos pasaron`.

- [ ] **Step 5: Commit**

```bash
git add scripts/sync/respondio.ts scripts/sync/plantillas.test.ts
git commit -m "feat(sync): deriveTemplateSends — extrae envios de template por conversacion"
```

---

## Task 4: Migración — tablas plantillas

**Files:**
- Create: `supabase/migrations/20260602160000_18_plantillas_tablas.sql`

- [ ] **Step 1: Escribir la migración**

Crear el archivo con:

```sql
-- Plantillas: catálogo (espejo de Templates_Outbound) + envíos por mensaje (de Chatwoot).
-- RLS habilitado SIN policies para anon: el dashboard lee solo vía RPC SECURITY DEFINER
-- (get_plantillas_stats). El sync escribe con service_role (bypassa RLS).

create table if not exists public.plantillas_catalogo (
  tenant_id     uuid    not null,
  template_name text    not null,
  shortcode     text,
  descripcion   text,
  activo        boolean,
  es_masivo     boolean not null default false,
  synced_at     timestamptz not null default now(),
  primary key (tenant_id, template_name)
);
alter table public.plantillas_catalogo enable row level security;
create index if not exists idx_plantillas_catalogo_masivo
  on public.plantillas_catalogo (tenant_id, es_masivo);

create table if not exists public.plantillas_envios (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid    not null,
  chatwoot_conversation_id bigint,
  chatwoot_message_id      bigint  not null,
  template_name            text    not null,
  es_masivo                boolean not null default false,
  enviado_at               timestamptz,
  status                   text,
  entregado                boolean not null default false,
  leido                    boolean not null default false,
  fallido                  boolean not null default false,
  contacto_nocodb_id       integer,
  respondido               boolean not null default false,
  synced_at                timestamptz not null default now(),
  unique (tenant_id, chatwoot_message_id)
);
alter table public.plantillas_envios enable row level security;
create index if not exists idx_plantillas_envios_rango
  on public.plantillas_envios (tenant_id, es_masivo, enviado_at);

-- service_role escribe (sync). anon/authenticated: sin grants directos (solo vía RPC).
grant select, insert, update, delete on public.plantillas_catalogo to service_role;
grant select, insert, update, delete on public.plantillas_envios   to service_role;
```

- [ ] **Step 2: Aplicar la migración a Supabase**

Aplicar vía MCP supabase `apply_migration` (project_id `dwnxldvrrzkqsqzlcvwt`, name `plantillas_tablas`) con el contenido del archivo.
Expected: success.

- [ ] **Step 3: Verificar que las tablas existen**

Vía MCP `execute_sql`:
```sql
select table_name from information_schema.tables
where table_schema='public' and table_name in ('plantillas_catalogo','plantillas_envios') order by 1;
```
Expected: 2 filas.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260602160000_18_plantillas_tablas.sql
git commit -m "feat(db): tablas plantillas_catalogo + plantillas_envios (RLS, sin anon directo)"
```

---

## Task 5: syncPlantillas — espejo del catálogo

**Files:**
- Modify: `scripts/sync/env.ts` (constante `TABLE_TEMPLATES`)
- Create: `scripts/sync/syncPlantillas.ts`
- Modify: `scripts/sync/index.ts` (registrar `plantillas`)

- [ ] **Step 1: Agregar la constante de tabla**

En `scripts/sync/env.ts`, dentro del objeto `env`, después de `TABLE_ATTEMPTS`, agregar:
```ts
  TABLE_TEMPLATES: process.env.VITE_TABLE_TEMPLATES?.trim() || 'mer3gkc3xj2stxj',
```

- [ ] **Step 2: Crear syncPlantillas.ts**

Crear `scripts/sync/syncPlantillas.ts`:

```ts
import { env } from './env.js';
import { fetchAllRows, NocoRow } from './nocodbClient.js';
import { supabaseAdmin } from './supabaseAdmin.js';
import { chunk, toText } from './helpers.js';

const BATCH_SIZE = 200;

export interface PlantillaCatalogoRecord {
  tenant_id: string;
  template_name: string;
  shortcode: string | null;
  descripcion: string | null;
  activo: boolean | null;
  es_masivo: boolean;
  synced_at: string;
}

function normalize(row: NocoRow, tenantId: string): PlantillaCatalogoRecord | null {
  const templateName = toText(row['template_name']);
  if (!templateName) return null;
  // es_masivo: el template está linkeado a >=1 campaña en Campanias_Mensajeria.
  const campanias = row['Campanias_Mensajeria'];
  const esMasivo = Array.isArray(campanias) && campanias.length > 0;
  return {
    tenant_id: tenantId,
    template_name: templateName,
    shortcode: toText(row['shortcode']),
    descripcion: toText(row['descripcion']),
    activo: row['activo'] == null ? null : Boolean(row['activo']),
    es_masivo: esMasivo,
    synced_at: new Date().toISOString(),
  };
}

export async function syncPlantillas(tenantId: string, runId: string) {
  console.log('\n=== Sync Plantillas (catálogo) ===');
  const started = Date.now();

  const rows = await fetchAllRows(env.TABLE_TEMPLATES, 'plantillas_catalogo');
  const records = rows
    .map((r) => normalize(r, tenantId))
    .filter((r): r is PlantillaCatalogoRecord => r !== null);

  let upserted = 0;
  for (const batch of chunk(records, BATCH_SIZE)) {
    const { error, count } = await supabaseAdmin
      .from('plantillas_catalogo')
      .upsert(batch, {
        onConflict: 'tenant_id,template_name',
        ignoreDuplicates: false,
        count: 'exact',
      });
    if (error) {
      await supabaseAdmin.from('sync_runs').update({
        status: 'error',
        finished_at: new Date().toISOString(),
        rows_failed: batch.length,
        error: { message: error.message, details: error.details },
      }).eq('id', runId);
      throw error;
    }
    upserted += count ?? batch.length;
  }

  const masivos = records.filter((r) => r.es_masivo).map((r) => r.template_name);
  console.log(`  ✓ ${upserted} templates en catálogo (${masivos.length} masivos: ${masivos.join(', ') || '—'}) en ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return { rows: upserted };
}
```

- [ ] **Step 3: Registrar en el orquestador**

En `scripts/sync/index.ts`:
- agregar el import: `import { syncPlantillas } from './syncPlantillas.js';`
- en el objeto `TABLES`, agregar `plantillas: syncPlantillas,` ANTES de `chatwoot: syncChatwoot,` (el catálogo debe existir antes de que chatwoot lea el set de masivos).

- [ ] **Step 4: Typecheck**

Run: `cd "Dashboard Yani Coach" && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Correr solo este sync y verificar**

Run: `cd "Dashboard Yani Coach" && npm run sync -- plantillas`
Expected: log "✓ N templates en catálogo (1 masivos: salto_cuantico_11dias …)". Si falla por credenciales, el subagente lo reporta como DONE_WITH_CONCERNS (la verificación real va en Task 11 en el VPS).

- [ ] **Step 6: Commit**

```bash
git add scripts/sync/env.ts scripts/sync/syncPlantillas.ts scripts/sync/index.ts
git commit -m "feat(sync): syncPlantillas — espejo del catalogo Templates_Outbound con es_masivo"
```

---

## Task 6: Extender syncChatwoot para llenar plantillas_envios

**Files:**
- Modify: `scripts/sync/syncChatwoot.ts`

- [ ] **Step 1: Importar deriveTemplateSends y el cliente**

En `scripts/sync/syncChatwoot.ts`, cambiar el import:
```ts
import { deriveRespondio, deriveTemplateSends } from './respondio.js';
```

- [ ] **Step 2: Agregar el tipo de registro de envío**

Después de la interface `ConvRecord`, agregar:
```ts
interface PlantillaEnvioRecord {
  tenant_id: string;
  chatwoot_conversation_id: number;
  chatwoot_message_id: number;
  template_name: string;
  es_masivo: boolean;
  enviado_at: string | null;
  status: string | null;
  entregado: boolean;
  leido: boolean;
  fallido: boolean;
  contacto_nocodb_id: number | null;
  respondido: boolean;
  synced_at: string;
}
```

- [ ] **Step 3: Leer el set de masivos al inicio de syncChatwoot**

Al principio del cuerpo de `syncChatwoot`, después de `const started = Date.now();`, agregar:
```ts
  // Set de templates masivos (a excluir del panel de día a día). Lo llena syncPlantillas,
  // que corre antes en el orquestador.
  const { data: catalogMasivos } = await supabaseAdmin
    .from('plantillas_catalogo')
    .select('template_name')
    .eq('tenant_id', tenantId)
    .eq('es_masivo', true);
  const masivoSet = new Set((catalogMasivos ?? []).map((r) => r.template_name as string));
  console.log(`  ${masivoSet.size} templates masivos a excluir`);

  const envios: PlantillaEnvioRecord[] = [];
```

- [ ] **Step 4: Acumular envíos dentro del worker**

Dentro de `worker`, después de `const r = deriveRespondio(messages);`, agregar:
```ts
      for (const ts of deriveTemplateSends(messages)) {
        envios.push({
          tenant_id: tenantId,
          chatwoot_conversation_id: c.id,
          chatwoot_message_id: ts.chatwoot_message_id,
          template_name: ts.template_name,
          es_masivo: masivoSet.has(ts.template_name),
          enviado_at: isoFromEpoch(ts.enviado_at),
          status: ts.status,
          entregado: ts.entregado,
          leido: ts.leido,
          fallido: ts.fallido,
          contacto_nocodb_id: c.contact_nocodb_id,
          respondido: ts.respondido,
          synced_at: new Date().toISOString(),
        });
      }
```
> Nota: `envios` puede tener duplicados de `chatwoot_message_id` solo si Chatwoot repite ids, lo cual no ocurre; el upsert por `(tenant_id, chatwoot_message_id)` es idempotente igual.

- [ ] **Step 5: Upsertar los envíos después del upsert de conversaciones**

Antes del `const elapsed = ...` final, agregar:
```ts
  // Dedup defensivo por chatwoot_message_id (último gana) y upsert.
  const enviosByMsg = new Map<number, PlantillaEnvioRecord>();
  for (const e of envios) enviosByMsg.set(e.chatwoot_message_id, e);
  const enviosUnicos = [...enviosByMsg.values()];
  let enviosUpserted = 0;
  for (const batch of chunk(enviosUnicos, BATCH_SIZE)) {
    const { error, count } = await supabaseAdmin
      .from('plantillas_envios')
      .upsert(batch, {
        onConflict: 'tenant_id,chatwoot_message_id',
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
    enviosUpserted += count ?? batch.length;
  }
  console.log(`  ✓ ${enviosUpserted} envíos de template upserted`);
```

- [ ] **Step 6: Typecheck**

Run: `cd "Dashboard Yani Coach" && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/sync/syncChatwoot.ts
git commit -m "feat(sync): syncChatwoot llena plantillas_envios (excluye masivos via catalogo)"
```

---

## Task 7: Migración — RPC get_plantillas_stats

**Files:**
- Create: `supabase/migrations/20260602170000_19_get_plantillas_stats.sql`

- [ ] **Step 1: Escribir la migración**

Crear el archivo con:

```sql
-- Agregador fechado de templates del día a día (es_masivo = false).
-- SECURITY DEFINER: el dashboard (anon) NO lee plantillas_envios directo;
-- solo recibe estos agregados (sin contacto_nocodb_id).
create or replace function public.get_plantillas_stats(
  p_tenant_id uuid,
  p_start timestamptz default null,
  p_end   timestamptz default null
)
returns table(
  template_name  text,
  shortcode      text,
  descripcion    text,
  enviados       bigint,
  entregados     bigint,
  leidos         bigint,
  fallidos       bigint,
  respondidos    bigint,
  tasa_entrega   numeric,
  tasa_apertura  numeric,
  tasa_respuesta numeric
)
language sql
stable
security definer
set statement_timeout to '120s'
set search_path to 'public', 'pg_temp'
as $function$
  select
    e.template_name,
    c.shortcode,
    c.descripcion,
    count(*)                                  as enviados,
    count(*) filter (where e.entregado)       as entregados,
    count(*) filter (where e.leido)           as leidos,
    count(*) filter (where e.fallido)         as fallidos,
    count(*) filter (where e.respondido)      as respondidos,
    round(count(*) filter (where e.entregado)::numeric  / nullif(count(*), 0), 3)                          as tasa_entrega,
    round(count(*) filter (where e.leido)::numeric      / nullif(count(*) filter (where e.entregado), 0), 3) as tasa_apertura,
    round(count(*) filter (where e.respondido)::numeric / nullif(count(*) filter (where e.entregado), 0), 3) as tasa_respuesta
  from public.plantillas_envios e
  left join public.plantillas_catalogo c
    on c.tenant_id = e.tenant_id and c.template_name = e.template_name
  where e.tenant_id = p_tenant_id
    and e.es_masivo = false
    and e.enviado_at >= coalesce(p_start, '-infinity'::timestamptz)
    and e.enviado_at <= coalesce(p_end,   'infinity'::timestamptz)
  group by e.template_name, c.shortcode, c.descripcion
  order by count(*) desc;
$function$;

revoke execute on function public.get_plantillas_stats(uuid, timestamptz, timestamptz) from public;
grant  execute on function public.get_plantillas_stats(uuid, timestamptz, timestamptz) to anon, authenticated, service_role;
```

- [ ] **Step 2: Aplicar la migración**

Aplicar vía MCP supabase `apply_migration` (project_id `dwnxldvrrzkqsqzlcvwt`, name `get_plantillas_stats`).
Expected: success.

- [ ] **Step 3: Verificar (devuelve 0 filas hasta que corra el sync, sin error)**

Vía MCP `execute_sql`:
```sql
select * from get_plantillas_stats('7558d73a-e97b-4422-ab5c-db87f6626592', null, null);
```
Expected: 0 filas (aún sin datos) y SIN error.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260602170000_19_get_plantillas_stats.sql
git commit -m "feat(db): RPC get_plantillas_stats (fechado, security definer, anon execute)"
```

---

## Task 8: dataSource.getPlantillasStats + tipo

**Files:**
- Modify: `services/types.ts`
- Modify: `services/dataSource.ts`

- [ ] **Step 1: Agregar el tipo PlantillaStatRow**

En `services/types.ts`, agregar:
```ts
export interface PlantillaStatRow {
  template_name: string;
  shortcode: string | null;
  descripcion: string | null;
  enviados: number;
  entregados: number;
  leidos: number;
  fallidos: number;
  respondidos: number;
  tasa_entrega: number | null;   // 0..1
  tasa_apertura: number | null;  // 0..1
  tasa_respuesta: number | null; // 0..1
}
```

- [ ] **Step 2: Agregar getPlantillasStats**

En `services/dataSource.ts`:
- agregar `PlantillaStatRow` al import de `./types`.
- agregar la función (junto a `getResponsividad`):
```ts
export async function getPlantillasStats(
  dateRange?: DateRange | null,
): Promise<PlantillaStatRow[]> {
  const { data, error } = await supabase.rpc('get_plantillas_stats', {
    p_tenant_id: TENANT_ID,
    p_start: dateRange?.start.toISOString() ?? null,
    p_end: dateRange?.end.toISOString() ?? null,
  });
  if (error) throw error;
  return ((data as any[]) ?? []).map((d) => ({
    template_name: String(d.template_name),
    shortcode: d.shortcode ?? null,
    descripcion: d.descripcion ?? null,
    enviados: Number(d.enviados ?? 0),
    entregados: Number(d.entregados ?? 0),
    leidos: Number(d.leidos ?? 0),
    fallidos: Number(d.fallidos ?? 0),
    respondidos: Number(d.respondidos ?? 0),
    tasa_entrega: d.tasa_entrega == null ? null : Number(d.tasa_entrega),
    tasa_apertura: d.tasa_apertura == null ? null : Number(d.tasa_apertura),
    tasa_respuesta: d.tasa_respuesta == null ? null : Number(d.tasa_respuesta),
  }));
}
```

- [ ] **Step 3: Typecheck**

Run: `cd "Dashboard Yani Coach" && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add services/types.ts services/dataSource.ts
git commit -m "feat(data): getPlantillasStats + tipo PlantillaStatRow"
```

---

## Task 9: Wiring cacheService + useDashboardData

**Files:**
- Modify: `services/cacheService.ts`
- Modify: `hooks/useDashboardData.ts`

- [ ] **Step 1: cacheService — import + tipo + carga**

En `services/cacheService.ts`:
- en el bloque de imports desde `./dataSource`, agregar `getPlantillasStats,`.
- en el import de tipos desde `./types`, agregar `PlantillaStatRow`.
- en `interface CachedData`, después de `responsividad: ResponsividadVendedoraRow[];`, agregar:
  ```ts
    plantillas: PlantillaStatRow[];
  ```
- en el `Promise.all` del paso 7, agregar la tercera llamada:
  ```ts
    const [funnelRespondio, responsividad, plantillas] = await Promise.all([
        getFunnelRespondio(dateRange),
        getResponsividad(dateRange),
        getPlantillasStats(dateRange),
    ]);
  ```
- en el objeto `return`, agregar `plantillas,` (junto a `responsividad,`).

- [ ] **Step 2: useDashboardData — estado + retorno**

En `hooks/useDashboardData.ts`:
- agregar `PlantillaStatRow` al import desde `../services/types`.
- en la interface `DashboardData`, después de `responsividad: ResponsividadVendedoraRow[];`, agregar:
  ```ts
    plantillas: PlantillaStatRow[];
  ```
- agregar el estado (junto a `responsividad`):
  ```ts
    const [plantillas, setPlantillas] = useState<PlantillaStatRow[]>([]);
  ```
- en `applyDataToState`, después de `setResponsividad(cachedData.responsividad);`, agregar:
  ```ts
        setPlantillas(cachedData.plantillas ?? []);
  ```
- en el objeto `return`, agregar `plantillas,` (junto a `responsividad,`).

- [ ] **Step 3: Typecheck**

Run: `cd "Dashboard Yani Coach" && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add services/cacheService.ts hooks/useDashboardData.ts
git commit -m "feat(data): cablear plantillas en cache + hook (fechado)"
```

---

## Task 10: Sección Plantillas en la UI

**Files:**
- Modify: `components/yc/Sidebar.tsx`
- Create: `components/views/PlantillasView.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Sidebar — hacer Plantillas navegable**

En `components/yc/Sidebar.tsx`:
- cambiar el tipo:
  ```ts
  export type SectionId = 'resumen' | 'ventas' | 'equipo' | 'embudo' | 'plantillas';
  ```
- agregar el item a `metricsItems` (después de `embudo`):
  ```ts
    { id: 'plantillas', label: 'Plantillas', Icon: Icons.Templates, active: activeSection === 'plantillas' },
  ```
- quitar `plantillas` de `soonItems` (dejar solo `masivos` y `clientes`):
  ```ts
  const soonItems: NavItem[] = [
    { id: 'masivos', label: 'Masivos WhatsApp', Icon: Icons.Whats },
    { id: 'clientes', label: 'Clientes', Icon: Icons.Clients },
  ];
  ```

- [ ] **Step 2: Crear PlantillasView.tsx**

Crear `components/views/PlantillasView.tsx`:

```tsx
// Yani Coach Dashboard — PlantillasView
// Sección "Plantillas": rendimiento de los templates del día a día (masivos excluidos).
// Props vienen del controller; ZERO números hardcodeados.
import React from 'react';
import { Icons } from '../yc/icons';
import type { PlantillaStatRow } from '../../services/types';

export interface PlantillasViewProps {
  plantillas: PlantillaStatRow[];
  rangeLabel: string;
}

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('es-AR');
}

function fmtPct(v: number | null): string {
  if (v == null) return '—';
  return `${Math.round(v * 100)}%`;
}

function nombreHumano(p: PlantillaStatRow): string {
  if (p.shortcode) return p.shortcode.replace(/_/g, ' ');
  return p.template_name.replace(/_/g, ' ');
}

const StatPill: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 92 }}>
    <span style={{ fontSize: 11, color: 'var(--yc-text-faint)' }}>{label}</span>
    <span className="yc-num" style={{ fontSize: 19, fontWeight: 600 }}>{value}</span>
    {sub && <span style={{ fontSize: 10.5, color: 'var(--yc-text-faint)' }}>{sub}</span>}
  </div>
);

const PlantillaCard: React.FC<{ p: PlantillaStatRow }> = ({ p }) => (
  <article className="yc-glass" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 15, fontWeight: 600, textTransform: 'capitalize' }}>{nombreHumano(p)}</span>
      {p.descripcion && (
        <span style={{ fontSize: 12, color: 'var(--yc-text-mute)', lineHeight: 1.4 }}>{p.descripcion}</span>
      )}
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
      <StatPill label="Enviados" value={fmtNum(p.enviados)} sub={p.fallidos > 0 ? `${fmtNum(p.fallidos)} fallidos` : undefined} />
      <StatPill label="Entrega" value={fmtPct(p.tasa_entrega)} sub={`${fmtNum(p.entregados)} entregados`} />
      <StatPill label="Apertura" value={fmtPct(p.tasa_apertura)} sub={`${fmtNum(p.leidos)} leídos`} />
      <StatPill label="Respuesta" value={fmtPct(p.tasa_respuesta)} sub={`${fmtNum(p.respondidos)} respondieron`} />
    </div>
  </article>
);

export const PlantillasView: React.FC<PlantillasViewProps> = ({ plantillas, rangeLabel }) => {
  const totalEnviados = plantillas.reduce((a, p) => a + p.enviados, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Plantillas del día a día</h1>
        <span style={{ fontSize: 13, color: 'var(--yc-text-mute)' }}>
          {rangeLabel} · {fmtNum(totalEnviados)} envíos · los masivos no se cuentan acá
        </span>
      </div>

      {plantillas.length === 0 ? (
        <div className="yc-glass" style={{ padding: 28, textAlign: 'center', color: 'var(--yc-text-mute)' }}>
          No hay envíos de plantillas en este período.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {plantillas.map((p) => <PlantillaCard key={p.template_name} p={p} />)}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', color: 'var(--yc-text-faint)', fontSize: 11.5, lineHeight: 1.5 }}>
        <Icons.Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          La <strong>apertura</strong> se mide con el read receipt de WhatsApp. Algunos contactos lo tienen
          desactivado, así que el porcentaje real de lectura puede ser mayor al que se muestra.
        </span>
      </div>
    </div>
  );
};

export default PlantillasView;
```
> Si `Icons.Info` no existe en `components/yc/icons.tsx`, el subagente debe usar un ícono existente equivalente (p. ej. `Icons.Summary`) o agregar uno mínimo; NO inventar un import que no exista. Verificar `icons.tsx` antes.

- [ ] **Step 3: App.tsx — consumir y montar**

En `App.tsx`:
- agregar el import: `import PlantillasView from './components/views/PlantillasView';`
- en el destructuring de `useDashboardData`, agregar `plantillas,` (junto a `responsividad,`).
- después del bloque `{section === 'embudo' && (...)}`, agregar:
  ```tsx
              {section === 'plantillas' && (
                <PlantillasView
                  plantillas={plantillas}
                  rangeLabel={presetToLabel(activePresetId)}
                />
              )}
  ```

- [ ] **Step 4: Typecheck + build**

Run: `cd "Dashboard Yani Coach" && npm run typecheck && npm run build`
Expected: PASS, build sin errores.

- [ ] **Step 5: Commit**

```bash
git add components/yc/Sidebar.tsx components/views/PlantillasView.tsx App.tsx
git commit -m "feat(ui): seccion Plantillas (envios, entrega, apertura, respuesta) con nota read-receipt"
```

---

## Task 11: Sync real, deploy y verificación en producción

**Files:** ninguno (operacional). Requiere SSH al VPS (`root@154.38.179.209`, key `~/.ssh/id_ed25519`).

- [ ] **Step 1: Push de todos los commits**

```bash
cd "Dashboard Yani Coach" && git push
```

- [ ] **Step 2: En el VPS — pull + rebuild de ambas imágenes**

Las migraciones ya están aplicadas a Supabase (Tasks 4 y 7). Falta desplegar el código (web + sync) y correr el sync.
```bash
ssh root@154.38.179.209 'cd /opt/dashboard-yani-coach && git pull && \
  source .env.build 2>/dev/null; \
  docker build -f Dockerfile.web --build-arg VITE_SUPABASE_URL --build-arg VITE_SUPABASE_ANON_KEY --build-arg VITE_TENANT_ID -t yani-dashboard-web:local . && \
  docker build -f scripts/sync/Dockerfile -t yani-dashboard-sync:local .'
```
> Verificar el nombre exacto del Dockerfile del sync (`scripts/sync/Dockerfile`) y los build-args reales en `.env.build` antes de correr; ajustar si difieren.

- [ ] **Step 3: Force-update de ambos servicios (tag :local requiere --force)**

```bash
ssh root@154.38.179.209 'docker service update --force --image yani-dashboard-sync:local yani-dashboard_yani_dashboard_sync && \
  docker service update --force --image yani-dashboard-web:local yani-dashboard_yani_dashboard_web'
```

- [ ] **Step 4: Disparar un sync completo y esperar a que termine**

```bash
ssh root@154.38.179.209 'CID=$(docker ps --filter name=yani_dashboard_sync -q | head -1) && docker exec $CID node --import tsx scripts/sync/index.js plantillas chatwoot 2>&1 | tail -20'
```
> Si el contenedor corre el sync por timer y no expone CLI, alternativamente: `docker exec $CID sh -c "cd /app && npx tsx scripts/sync/index.ts plantillas chatwoot"`. Ajustar al entrypoint real del contenedor sync.
Expected: logs "✓ N templates en catálogo (1 masivos…)" y "✓ N envíos de template upserted".

- [ ] **Step 5: Verificar datos en Supabase (vía MCP execute_sql)**

```sql
select count(*) total,
       count(*) filter (where es_masivo) masivos,
       count(*) filter (where not es_masivo) dia_a_dia
from plantillas_envios where tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592';

select * from get_plantillas_stats('7558d73a-e97b-4422-ab5c-db87f6626592', null, null);
```
Expected: filas reales; `salto_cuantico_11dias` cae en `masivos` y NO aparece en `get_plantillas_stats`.

- [ ] **Step 6: Verificar el tiempo de respuesta humano cambió**

```sql
select vendedora_nombre, chats_respondidos, resp_mediana_min
from get_responsividad('7558d73a-e97b-4422-ab5c-db87f6626592', now()-interval '30 days', now());
```
Expected: `resp_mediana_min` ahora refleja tiempo humano (mayor que el ~0 anterior; ya no domina el auto-reply).

- [ ] **Step 7: Verificar el sitio en vivo (Playwright)**

Navegar a `https://dashboard.yanicoach.com/?nocache=plantillas` (cache-bust), login si hace falta, click en "Plantillas" en el sidebar. Verificar: la sección renderiza tarjetas con datos reales, el filtro de fecha cambia los números, 0 errores de consola, la nota de read receipt aparece, NO aparece `salto_cuantico_11dias`.

- [ ] **Step 8: Commit de cierre (memoria + notas)**

Actualizar el archivo de memoria `dashboard_produccion_deploy.md` con el deploy de la sección Plantillas y el fix de tiempo de respuesta humano. (No es un commit de código; es la nota operativa.)

---

## Notas para el ejecutor

- **TDD:** Tasks 2 y 3 son test-first. No saltear el paso "verificar que falla".
- **Cero datos falsos:** si algo no tiene datos, mostrar vacío/honesto — nunca rellenar.
- **No tocar** la lógica de `respondio` (señal) más allá de lo indicado; solo cambia el TIEMPO.
- **Verificar imports reales** antes de usarlos (`Icons.Info`, `toText`, nombres de Dockerfile/servicios). El plan marca dónde.
- **El sync ya hace full-scan** (~3 min). Task 6 reusa los mensajes ya traídos; no agrega requests a Chatwoot.
