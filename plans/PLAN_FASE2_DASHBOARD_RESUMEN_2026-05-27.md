# Fase 2 — Vista "Resumen" del Dashboard (embudo real + diseño aprobado) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la vista "Resumen" del dashboard (el embudo que Yani quiere ver: Leads → Primer mensaje → Respondieron → Interesados → Venta) con datos REALES y frescos, portando el diseño premium aprobado.

**Architecture:** El backend gana un RPC `get_funnel_respondio` parametrizado por fecha que (1) cuenta ventas desde la tabla `ventas` —fuente de verdad real— en vez del campo `Estado Actual` del contacto (que casi nunca se actualiza), y (2) usa MEDIANA, no media, para el tiempo de respuesta. Se re-sincronizan los mirrors stale (ventas lleva sin sync desde el 18-abr). El frontend agrega funciones en `dataSource.ts`, una función pura de transformación testeada, y un componente `EmbudoRespondio` que porta el diseño dorado aprobado, integrado en la landing "Resumen Ejecutivo".

**Tech Stack:** PostgreSQL (Supabase, proyecto `dwnxldvrrzkqsqzlcvwt`), TypeScript + `tsx` para sync/tests (NO hay framework de tests; los tests son scripts `tsx` con `node:assert/strict`), React 19 + Vite 6 + Tailwind 4 (paleta `gold-*` ya definida) + Recharts 3, Supabase JS anon client.

---

## Contexto crítico (leer antes de empezar)

**Diagnóstico corregido (la memoria decía otra cosa):**
- `helpers.mapEstadoSimplificado` YA mapea `'Venta Ganada'→'Venta Cerrada'` correctamente. NO es un bug de mapping.
- La razón de `venta_cerrada=14` es que en NocoDB Contactos solo 14 registros tienen `Estado Actual='Venta Ganada'` — el dropdown del contacto casi nunca se actualiza al cerrar venta.
- La **fuente de verdad de ventas es la tabla `ventas`**: NocoDB tiene **348 ventas** / ~250 contactos distintos. Supabase tiene solo **180** porque `ventas` no se sincroniza **desde el 2026-04-18**.
- Por eso el embudo debe contar `venta_cerrada` como "contactos con ≥1 fila en `ventas`", NO por `estado_simplificado`.

**Números reales validados (datos stale actuales, query corrida 2026-05-27):**
- leads_nuevos (todos los contactos): 31257 — necesita filtro de fecha para ser útil
- respondieron: 829 · interesados: 179 · **venta_cerrada (desde ventas): 153** (era 14) · venta_perdida: 396
- tiempo respuesta: **mediana 36.7 min** vs media 560.4 min → la media es basura, usar mediana siempre.

**Schema confirmado:**
- `ventas`: tiene `contacto_nocodb_id` (int) Y `contacto_id` (uuid, FK resuelto por `resolve_foreign_keys`), `vendedora_id` (uuid), `amount`, `fecha`, `payment_status`.
- `chatwoot_conversaciones`: `contacto_id` (uuid), `respondio` (bool), `tiempo_primera_respuesta_seg` (int), `vendedora_id` (uuid), `primer_outbound_at`, `primer_inbound_at`.
- `contactos`: `id` (uuid), `nocodb_id` (int), `estado_simplificado` (text), `nocodb_created_at` (timestamptz).

**Restricciones del proyecto (CLAUDE.md + memoria):**
- NO tocar workflows de n8n (solo lectura para analytics).
- CERO datos demo/fake: los fallos deben verse reales.
- El código del frontend vive en la RAÍZ del proyecto (`App.tsx`, `components/`, `hooks/`, `services/`), NO en `src/`.
- Imports ESM en archivos `.ts` usan extensión `.js`.
- Migraciones en `supabase/migrations/`, naming `YYYYMMDDHHMMSS_NN_nombre.sql`. La última fue `20260527160500_13_funnel_respondio.sql`.
- `round(double, int)` no existe en PG → castear con `::numeric`.
- Trabajar en la rama `feature/fase1-senal-respondio` (continúa) o crear `feature/fase2-resumen`. NO mergear a `main` (tiene archivos sucios previos sin tocar).

**Patrón de datos existente (replicar):**
- `services/dataSource.ts` filtra todo por `TENANT_ID`. RPC se llama así:
  ```ts
  const { data, error } = await supabase.rpc('get_interaction_counts', {
    p_tenant_id: TENANT_ID,
    p_start: dateRange?.start.toISOString() ?? null,
    p_end: dateRange?.end.toISOString() ?? null,
  });
  ```
- `services/cacheService.ts` arma `CachedData` (incluye `sellers, contacts, funnelCounts, kpiCounts, ...`) vía `getSummaryMetrics(dateRange)`.
- `hooks/useDashboardData.ts` consume `cacheService.getData()` y expone props a las vistas.
- `components/ExecutiveView.tsx` es la landing "Resumen Ejecutivo" (tab `executive` en `App.tsx:84`).
- Diseño aprobado: `diseno-aprobado/dashboard.jsx` (974 líneas). Paleta: `--yc-gold #E7C15A`, `--yc-gold-2 #D4AF37`, `--yc-green #10B981`, `--yc-red #EF4444`. En Tailwind: `gold-400 = #D4AF37`.

---

## File Structure

**Crear:**
- `supabase/migrations/20260527170000_14_funnel_ventas_median.sql` — RPC `get_funnel_respondio` (fecha-param, ventas desde tabla `ventas`, mediana) + `v_responsividad_vendedora` a mediana.
- `scripts/test_funnel_rpc.ts` — test tsx que asserta el RPC contra prod.
- `services/funnelTransform.ts` — función pura `buildEmbudoStages(row)` → array de etapas para la UI.
- `services/funnelTransform.test.ts` — test tsx de `buildEmbudoStages`.
- `components/EmbudoRespondio.tsx` — el embudo visual (port del diseño aprobado).

**Modificar:**
- `services/types.ts` — agregar `FunnelRespondioRow`, `ResponsividadVendedoraRow`, `EmbudoStage`.
- `services/dataSource.ts` — agregar `getFunnelRespondio(dateRange?)` y `getResponsividad()`.
- `services/cacheService.ts` — incluir `funnelRespondio` + `responsividad` en `CachedData` y en la carga.
- `hooks/useDashboardData.ts` — exponer `funnelRespondio` y `responsividad`.
- `components/ExecutiveView.tsx` — renderizar `<EmbudoRespondio>` + tarjeta de responsividad (mediana).

---

## FASE A — Datos correctos (SQL + re-sync)

### Task 1: Migración 14 — RPC `get_funnel_respondio` + responsividad a mediana

**Files:**
- Create: `supabase/migrations/20260527170000_14_funnel_ventas_median.sql`
- Create: `scripts/test_funnel_rpc.ts`

- [ ] **Step 1: Escribir el test que falla (RPC todavía no existe)**

Crear `scripts/test_funnel_rpc.ts`:

```ts
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
const TENANT = '7558d73a-e97b-4422-ab5c-db87f6626592';

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

async function main() {
  // Sin filtro de fecha: el embudo histórico completo
  const { data, error } = await supabase.rpc('get_funnel_respondio', {
    p_tenant_id: TENANT,
    p_start: null,
    p_end: null,
  });
  assert.equal(error, null, `RPC error: ${error?.message}`);
  assert.ok(Array.isArray(data) && data.length === 1, 'RPC debe devolver 1 fila');
  const r = data[0];

  // venta_cerrada sale de la tabla ventas, NO del estado: debe ser >> 14
  assert.ok(r.venta_cerrada > 100, `venta_cerrada=${r.venta_cerrada} debe ser >100 (sale de ventas)`);
  assert.ok(r.respondieron > 0, 'respondieron debe ser >0');
  assert.ok(r.leads_nuevos >= r.respondieron, 'leads_nuevos >= respondieron');
  // mediana << media (la media está inflada por outliers)
  assert.ok(
    r.tiempo_resp_mediana_min !== null && r.tiempo_resp_mediana_min < 120,
    `mediana=${r.tiempo_resp_mediana_min} debe ser <120min`,
  );

  // Con filtro de fecha (últimos 30 días) leads_nuevos debe ser menor que el histórico
  const start = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data: d2, error: e2 } = await supabase.rpc('get_funnel_respondio', {
    p_tenant_id: TENANT, p_start: start, p_end: new Date().toISOString(),
  });
  assert.equal(e2, null, `RPC fecha error: ${e2?.message}`);
  assert.ok(d2[0].leads_nuevos < r.leads_nuevos, 'filtro de fecha debe reducir leads_nuevos');

  console.log('✓ get_funnel_respondio OK', JSON.stringify(r));
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "Dashboard Yani Coach" && set -a && . ./scripts/sync/.env && set +a && npx tsx scripts/test_funnel_rpc.ts`
(Si no existe `scripts/sync/.env`, usar el archivo de entorno que ya consume el sync — ver `scripts/sync/env.ts` para los nombres: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.)
Expected: FALLA con error tipo `function get_funnel_respondio does not exist` o `PGRST202`.

- [ ] **Step 3: Escribir la migración**

Crear `supabase/migrations/20260527170000_14_funnel_ventas_median.sql`:

```sql
-- ============================================================================
-- Fase 2 — Embudo correcto: ventas desde la tabla `ventas` (no estado), mediana.
-- Reemplaza la lógica fallida de v_funnel_respondio (que contaba venta por
-- estado_simplificado='Venta Cerrada' = 14, cuando ventas reales son ~250).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_funnel_respondio(
  p_tenant_id uuid,
  p_start timestamptz DEFAULT NULL,
  p_end   timestamptz DEFAULT NULL
)
RETURNS TABLE (
  leads_nuevos            bigint,
  primer_mensaje          bigint,
  respondieron            bigint,
  interesados             bigint,
  venta_cerrada           bigint,
  venta_perdida           bigint,
  tiempo_resp_mediana_min numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH leads AS (
    SELECT c.id, c.estado_simplificado
    FROM public.contactos c
    WHERE c.tenant_id = p_tenant_id
      AND (p_start IS NULL OR c.nocodb_created_at >= p_start)
      AND (p_end   IS NULL OR c.nocodb_created_at <= p_end)
  ),
  conv AS (
    SELECT contacto_id,
           bool_or(respondio)                  AS respondio,
           bool_or(primer_outbound_at IS NOT NULL) AS tiene_outbound,
           min(tiempo_primera_respuesta_seg)   AS t
    FROM public.chatwoot_conversaciones
    WHERE tenant_id = p_tenant_id AND contacto_id IS NOT NULL
    GROUP BY contacto_id
  ),
  con_venta AS (
    SELECT DISTINCT contacto_id
    FROM public.ventas
    WHERE tenant_id = p_tenant_id AND contacto_id IS NOT NULL
  )
  SELECT
    count(*)                                                              AS leads_nuevos,
    count(*) FILTER (WHERE cv.tiene_outbound)                             AS primer_mensaje,
    count(*) FILTER (WHERE cv.respondio)                                  AS respondieron,
    count(*) FILTER (WHERE l.estado_simplificado = 'Interesado')          AS interesados,
    count(*) FILTER (WHERE v.contacto_id IS NOT NULL)                     AS venta_cerrada,
    count(*) FILTER (WHERE l.estado_simplificado = 'Venta Perdida')       AS venta_perdida,
    round(
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY cv.t)
        FILTER (WHERE cv.t IS NOT NULL) / 60.0)::numeric, 1)              AS tiempo_resp_mediana_min
  FROM leads l
  LEFT JOIN conv cv      ON cv.contacto_id = l.id
  LEFT JOIN con_venta v  ON v.contacto_id  = l.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_funnel_respondio(uuid, timestamptz, timestamptz) TO anon;

-- Responsividad por vendedora: cambiar media -> mediana (los outliers la inflaban).
CREATE OR REPLACE VIEW public.v_responsividad_vendedora AS
SELECT
  cc.tenant_id,
  cc.vendedora_id,
  v.nombre AS vendedora_nombre,
  count(*) FILTER (WHERE cc.respondio) AS chats_respondidos,
  round(
    (percentile_cont(0.5) WITHIN GROUP (ORDER BY cc.tiempo_primera_respuesta_seg)
      FILTER (WHERE cc.tiempo_primera_respuesta_seg IS NOT NULL) / 60.0)::numeric, 1
  ) AS resp_mediana_min
FROM public.chatwoot_conversaciones cc
LEFT JOIN public.vendedoras v ON v.id = cc.vendedora_id
WHERE cc.vendedora_id IS NOT NULL
GROUP BY cc.tenant_id, cc.vendedora_id, v.nombre;

GRANT SELECT ON public.v_responsividad_vendedora TO anon;
```

- [ ] **Step 4: Aplicar la migración a Supabase**

Aplicar vía MCP `mcp__supabase__apply_migration` (project_id `dwnxldvrrzkqsqzlcvwt`, name `20260527170000_14_funnel_ventas_median`, query = contenido del archivo).
Expected: success, sin error de sintaxis.

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd "Dashboard Yani Coach" && set -a && . ./scripts/sync/.env && set +a && npx tsx scripts/test_funnel_rpc.ts`
Expected: PASS — imprime `✓ get_funnel_respondio OK {...}` con `venta_cerrada` ~153 (subirá tras el re-sync de Task 2), `tiempo_resp_mediana_min` ~36.7.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260527170000_14_funnel_ventas_median.sql scripts/test_funnel_rpc.ts
git commit -m "feat(fase2): RPC get_funnel_respondio (ventas reales + mediana)"
```

---

### Task 2: Re-sync de los mirrors stale (ventas/interacciones/intentos)

**Files:** ninguno (tarea operativa); verificación por SQL.

`ventas` no sincroniza desde 2026-04-18. El orquestador `scripts/sync/index.ts` sincroniza todas las tablas y al final corre `resolve_foreign_keys` (puebla `ventas.contacto_id`) + `resolve_chatwoot_fks` + refresca MVs. NO requiere cambios de código.

- [ ] **Step 1: Verificar el estado stale (baseline)**

Vía `mcp__supabase__execute_sql` (project `dwnxldvrrzkqsqzlcvwt`):
```sql
SELECT count(*) AS ventas_rows, max(synced_at) AS last_sync
FROM public.ventas WHERE tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592';
```
Expected: ~180 rows, last_sync 2026-04-18 (stale). NocoDB real = 348.

- [ ] **Step 2: Correr el sync completo**

Run: `cd "Dashboard Yani Coach" && set -a && . ./scripts/sync/.env && set +a && npx tsx scripts/sync/index.ts`
Expected: logs de cada tabla (Contactos, Interacciones, Ventas, Intentos, Vendedoras, Chatwoot), luego `resolve_foreign_keys`, `resolve_chatwoot_fks`, `refresh_materialized_views`, y un `sync_runs` con status `success`. Sin filas `running` huérfanas.
Si NocoDB tira 429: el cliente ya tiene retry/backoff (`scripts/sync/nocodbClient.ts`). Si aborta a mitad, re-correr (los upserts son idempotentes por `onConflict tenant_id,nocodb_id`).

- [ ] **Step 3: Verificar que ventas se refrescó y el embudo subió**

Vía `mcp__supabase__execute_sql`:
```sql
SELECT
  (SELECT count(*) FROM public.ventas WHERE tenant_id='7558d73a-e97b-4422-ab5c-db87f6626592') AS ventas_rows,
  (SELECT venta_cerrada FROM public.get_funnel_respondio('7558d73a-e97b-4422-ab5c-db87f6626592', NULL, NULL)) AS venta_cerrada;
```
Expected: `ventas_rows` ~348 (no 180), `venta_cerrada` sube de 153 hacia ~250.

- [ ] **Step 4: Confirmar que no quedaron sync_runs huérfanos**

```sql
SELECT id, source, status, started_at FROM public.sync_runs
WHERE status='running' ORDER BY started_at DESC LIMIT 5;
```
Expected: 0 filas. Si hay una huérfana de una corrida abortada, marcarla:
```sql
UPDATE public.sync_runs SET status='error', finished_at=now(),
  error='{"message":"aborted, superseded by re-sync"}'::jsonb
WHERE status='running';
```

- [ ] **Step 5: Commit (registro del re-sync)**

```bash
git commit --allow-empty -m "chore(fase2): re-sync mirrors stale (ventas 180->348, FKs resueltas)"
```

---

## FASE B — Frontend (wiring + diseño aprobado)

### Task 3: Funciones de datos en `dataSource.ts` + tipos

**Files:**
- Modify: `services/types.ts`
- Modify: `services/dataSource.ts`

- [ ] **Step 1: Agregar tipos en `services/types.ts`**

Añadir al final del archivo:

```ts
export interface FunnelRespondioRow {
  leads_nuevos: number;
  primer_mensaje: number;
  respondieron: number;
  interesados: number;
  venta_cerrada: number;
  venta_perdida: number;
  tiempo_resp_mediana_min: number | null;
}

export interface ResponsividadVendedoraRow {
  vendedora_id: string;
  vendedora_nombre: string | null;
  chats_respondidos: number;
  resp_mediana_min: number | null;
}
```

- [ ] **Step 2: Agregar funciones en `services/dataSource.ts`**

Importar los tipos al inicio del archivo (junto a los imports de tipos existentes):

```ts
import type { FunnelRespondioRow, ResponsividadVendedoraRow } from './types';
```

Agregar al final del archivo (replicando el patrón de `getInteractionCounts`, que ya usa `supabase.rpc` y `TENANT_ID`):

```ts
/** Embudo Leads→Respondieron→Interesados→Venta (ventas reales + mediana). */
export async function getFunnelRespondio(
  dateRange?: DateRange | null,
): Promise<FunnelRespondioRow> {
  const { data, error } = await supabase.rpc('get_funnel_respondio', {
    p_tenant_id: TENANT_ID,
    p_start: dateRange?.start.toISOString() ?? null,
    p_end: dateRange?.end.toISOString() ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    leads_nuevos: Number(row?.leads_nuevos ?? 0),
    primer_mensaje: Number(row?.primer_mensaje ?? 0),
    respondieron: Number(row?.respondieron ?? 0),
    interesados: Number(row?.interesados ?? 0),
    venta_cerrada: Number(row?.venta_cerrada ?? 0),
    venta_perdida: Number(row?.venta_perdida ?? 0),
    tiempo_resp_mediana_min:
      row?.tiempo_resp_mediana_min === null || row?.tiempo_resp_mediana_min === undefined
        ? null
        : Number(row.tiempo_resp_mediana_min),
  };
}

/** Responsividad (mediana de respuesta) por vendedora. */
export async function getResponsividad(): Promise<ResponsividadVendedoraRow[]> {
  const { data, error } = await supabase
    .from('v_responsividad_vendedora')
    .select('vendedora_id, vendedora_nombre, chats_respondidos, resp_mediana_min')
    .eq('tenant_id', TENANT_ID)
    .order('chats_respondidos', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d) => ({
    vendedora_id: d.vendedora_id,
    vendedora_nombre: d.vendedora_nombre ?? null,
    chats_respondidos: Number(d.chats_respondidos ?? 0),
    resp_mediana_min: d.resp_mediana_min === null ? null : Number(d.resp_mediana_min),
  }));
}
```

- [ ] **Step 3: Smoke test contra prod (anon)**

Crear y correr un smoke inline:
```bash
cd "Dashboard Yani Coach" && set -a && . ./.env.local && set +a && npx tsx -e "
import { getFunnelRespondio, getResponsividad } from './services/dataSource';
(async () => {
  console.log('funnel', await getFunnelRespondio());
  console.log('resp', (await getResponsividad()).slice(0,3));
})().catch(e => { console.error(e); process.exit(1); });
"
```
Expected: imprime el embudo (`venta_cerrada` ~250 post-resync) y top-3 vendedoras con `resp_mediana_min`. Si falla por env, usar los nombres de `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_TENANT_ID`) — `services/supabaseClient.ts` los lee vía `import.meta.env`; para el smoke con tsx, exportarlos sin el prefijo VITE o ajustar el script para leer `process.env`. Si el anon no tiene permiso, el GRANT de Task 1 lo cubre.

- [ ] **Step 4: Typecheck**

Run: `cd "Dashboard Yani Coach" && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add services/types.ts services/dataSource.ts
git commit -m "feat(fase2): dataSource getFunnelRespondio + getResponsividad"
```

---

### Task 4: Función pura `buildEmbudoStages` (TDD)

**Files:**
- Create: `services/funnelTransform.ts`
- Create: `services/funnelTransform.test.ts`

Transforma la fila del RPC en las etapas que dibuja el embudo, con % sobre leads y % de caída (drop-off) respecto a la etapa anterior. "Agendó llamada" es etapa `soon` (Calendly = Fase 3).

- [ ] **Step 1: Escribir el test que falla**

Crear `services/funnelTransform.test.ts`:

```ts
import assert from 'node:assert/strict';
import { buildEmbudoStages } from './funnelTransform.js';
import type { FunnelRespondioRow } from './types.js';

const row: FunnelRespondioRow = {
  leads_nuevos: 310,
  primer_mensaje: 310,
  respondieron: 124,
  interesados: 58,
  venta_cerrada: 20,
  venta_perdida: 90,
  tiempo_resp_mediana_min: 36.7,
};

const stages = buildEmbudoStages(row);

// 6 etapas: leads, primer_mensaje, respondieron(star), interesados, venta_cerrada, agendo(soon)
assert.equal(stages.length, 6);
assert.equal(stages[0].id, 'leads');
assert.equal(stages[0].count, 310);
assert.equal(stages[0].pctOfLeads, 100);
assert.equal(stages[0].dropFromPrev, null); // primera etapa no tiene caída

// Respondieron: 124/310 = 40% de leads; caída desde primer_mensaje (310): 60%
const reply = stages.find((s) => s.id === 'respondieron')!;
assert.equal(reply.star, true);
assert.equal(reply.pctOfLeads, 40);
assert.equal(reply.dropFromPrev, 60);

// Etapa "agendó" es soon: count null, no rompe los porcentajes
const call = stages.find((s) => s.id === 'agendo')!;
assert.equal(call.soon, true);
assert.equal(call.count, null);

// leads_nuevos=0 no debe dividir por cero
const zero = buildEmbudoStages({ ...row, leads_nuevos: 0, primer_mensaje: 0, respondieron: 0, interesados: 0, venta_cerrada: 0 });
assert.equal(zero[0].pctOfLeads, 0);
assert.ok(zero.every((s) => Number.isFinite(s.pctOfLeads)));

console.log('✓ buildEmbudoStages OK');
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd "Dashboard Yani Coach" && npx tsx services/funnelTransform.test.ts`
Expected: FALLA con `Cannot find module './funnelTransform.js'`.

- [ ] **Step 3: Escribir la implementación mínima**

Agregar `EmbudoStage` en `services/types.ts`:

```ts
export interface EmbudoStage {
  id: 'leads' | 'primer_mensaje' | 'respondieron' | 'interesados' | 'venta_cerrada' | 'agendo';
  label: string;
  count: number | null;        // null = etapa "soon" (sin dato aún)
  pctOfLeads: number;          // count / leads_nuevos * 100, redondeado
  dropFromPrev: number | null; // % perdido vs etapa previa con dato; null en la primera
  star?: boolean;              // métrica clave (Respondieron)
  soon?: boolean;              // etapa futura (Calendly = Fase 3)
}
```

Crear `services/funnelTransform.ts`:

```ts
import type { FunnelRespondioRow, EmbudoStage } from './types.js';

const pct = (n: number, base: number): number =>
  base > 0 ? Math.round((n / base) * 100) : 0;

/** Convierte la fila del RPC en las etapas del embudo para la UI. */
export function buildEmbudoStages(row: FunnelRespondioRow): EmbudoStage[] {
  const leads = row.leads_nuevos;
  const defs: Array<{ id: EmbudoStage['id']; label: string; count: number | null; star?: boolean; soon?: boolean }> = [
    { id: 'leads',         label: 'Leads nuevos',            count: row.leads_nuevos },
    { id: 'primer_mensaje',label: 'Primer mensaje enviado',  count: row.primer_mensaje },
    { id: 'respondieron',  label: 'Respondieron',            count: row.respondieron, star: true },
    { id: 'interesados',   label: 'Interesados',             count: row.interesados },
    { id: 'venta_cerrada', label: 'Venta cerrada',           count: row.venta_cerrada },
    { id: 'agendo',        label: 'Agendó / entró en llamada', count: null, soon: true },
  ];

  let prevCount: number | null = null;
  return defs.map((d) => {
    const dropFromPrev =
      d.count !== null && prevCount !== null && prevCount > 0
        ? Math.round(((prevCount - d.count) / prevCount) * 100)
        : null;
    if (d.count !== null) prevCount = d.count;
    return {
      ...d,
      pctOfLeads: d.count !== null ? pct(d.count, leads) : 0,
      dropFromPrev,
    };
  });
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd "Dashboard Yani Coach" && npx tsx services/funnelTransform.test.ts`
Expected: PASS — `✓ buildEmbudoStages OK`.

- [ ] **Step 5: Commit**

```bash
git add services/types.ts services/funnelTransform.ts services/funnelTransform.test.ts
git commit -m "feat(fase2): buildEmbudoStages (transform puro + test)"
```

---

### Task 5: Wire en `cacheService` + `useDashboardData`

**Files:**
- Modify: `services/cacheService.ts`
- Modify: `hooks/useDashboardData.ts`

- [ ] **Step 1: Extender `CachedData` y la carga en `cacheService.ts`**

En `services/cacheService.ts`, importar las funciones y tipos:
```ts
import { getFunnelRespondio, getResponsividad } from './dataSource';
import type { FunnelRespondioRow, ResponsividadVendedoraRow } from './types';
```

Agregar a la interface `CachedData`:
```ts
  funnelRespondio: FunnelRespondioRow;
  responsividad: ResponsividadVendedoraRow[];
```

En la función que arma los datos (donde hoy se llama `getSummaryMetrics(dateRange)` y se asignan `sellers`, `contacts`, etc.), agregar a las cargas paralelas y al objeto retornado:
```ts
  const [/* ...existentes..., */ funnelRespondio, responsividad] = await Promise.all([
    /* ...las promesas existentes..., */
    getFunnelRespondio(dateRange),
    getResponsividad(),
  ]);
```
y añadir `funnelRespondio, responsividad` al objeto `CachedData` que se construye y cachea.
(El embudo depende de `dateRange`; `responsividad` es global, igual que `sellers`. Si el código reusa `sellers` entre rangos, NO reusar `funnelRespondio` —recargarlo por rango.)

- [ ] **Step 2: Exponer en `hooks/useDashboardData.ts`**

En `hooks/useDashboardData.ts`, agregar a `UseDashboardDataResult`:
```ts
  funnelRespondio: FunnelRespondioRow;
  responsividad: ResponsividadVendedoraRow[];
```
(importar los tipos desde `../services/types`), agregar estado:
```ts
const [funnelRespondio, setFunnelRespondio] = useState<FunnelRespondioRow>({
  leads_nuevos: 0, primer_mensaje: 0, respondieron: 0, interesados: 0,
  venta_cerrada: 0, venta_perdida: 0, tiempo_resp_mediana_min: null,
});
const [responsividad, setResponsividad] = useState<ResponsividadVendedoraRow[]>([]);
```
y en el punto donde se asignan los demás campos del `cachedData` (y en la suscripción `subscribe`), agregar:
```ts
setFunnelRespondio(cachedData.funnelRespondio);
setResponsividad(cachedData.responsividad);
```
Incluir ambos en el objeto que retorna el hook.

- [ ] **Step 3: Typecheck**

Run: `cd "Dashboard Yani Coach" && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add services/cacheService.ts hooks/useDashboardData.ts
git commit -m "feat(fase2): wire funnelRespondio + responsividad por el cache/hook"
```

---

### Task 6: Componente `EmbudoRespondio` (port del diseño aprobado)

**Files:**
- Create: `components/EmbudoRespondio.tsx`

Port del embudo de `diseno-aprobado/dashboard.jsx`: barras horizontales animadas, tema dorado, % de caída a mitad de barra, estrella en "Respondieron", etapa "Agendó" como `soon`. Sin nuevas dependencias (CSS transitions + clases Tailwind `gold-*`; animación de entrada con `animate-fade-in-up` ya definida en `tailwind.config.js`).

- [ ] **Step 1: Crear el componente**

Crear `components/EmbudoRespondio.tsx`:

```tsx
import type { FunnelRespondioRow } from '../services/types';
import { buildEmbudoStages } from '../services/funnelTransform';

interface EmbudoRespondioProps {
  funnel: FunnelRespondioRow;
  isLoading?: boolean;
}

export default function EmbudoRespondio({ funnel, isLoading }: EmbudoRespondioProps) {
  const stages = buildEmbudoStages(funnel);
  const maxCount = Math.max(1, ...stages.map((s) => s.count ?? 0));

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-white/10">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">Embudo del negocio</h3>
          <p className="text-sm text-gray-400">De lead nuevo a venta cerrada</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-gray-500">Respuesta (mediana)</p>
          <p className="text-xl font-bold text-gold-400">
            {funnel.tiempo_resp_mediana_min !== null ? `${funnel.tiempo_resp_mediana_min} min` : '—'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {stages.map((s, i) => {
          const widthPct = s.count !== null ? Math.max(6, (s.count / maxCount) * 100) : 100;
          return (
            <div key={s.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-300 flex items-center gap-1.5">
                  {s.star && <span className="text-gold-400" aria-hidden>★</span>}
                  {s.label}
                  {s.soon && <span className="text-[10px] uppercase text-gray-500 border border-gray-600 rounded px-1.5 py-0.5">pronto</span>}
                </span>
                <span className="text-sm font-semibold text-gray-100">
                  {s.count !== null ? `${s.count.toLocaleString('es-AR')} · ${s.pctOfLeads}%` : '—'}
                </span>
              </div>
              <div className="relative h-8 rounded-md bg-gray-700/40 overflow-hidden">
                <div
                  className={`h-full rounded-md transition-[width] duration-700 ease-out ${
                    s.soon ? 'bg-gray-600/40' : s.star ? 'bg-gold-400' : 'bg-gold-600'
                  }`}
                  style={{ width: isLoading ? '0%' : `${widthPct}%` }}
                />
                {s.dropFromPrev !== null && s.dropFromPrev > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-400">
                    −{s.dropFromPrev}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-white/10 flex gap-6 text-sm">
        <span className="text-gray-400">Venta perdida:
          <span className="ml-1 font-semibold text-red-400">{funnel.venta_perdida.toLocaleString('es-AR')}</span>
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila (build)**

Run: `cd "Dashboard Yani Coach" && npx tsc --noEmit && npx vite build`
Expected: build OK, sin errores TS ni de Tailwind (clases `gold-400`/`gold-600` existen en `tailwind.config.js`).

- [ ] **Step 3: Commit**

```bash
git add components/EmbudoRespondio.tsx
git commit -m "feat(fase2): componente EmbudoRespondio (diseño dorado aprobado)"
```

---

### Task 7: Integrar el embudo en la vista "Resumen Ejecutivo"

**Files:**
- Modify: `components/ExecutiveView.tsx`

- [ ] **Step 1: Recibir las props nuevas en `ExecutiveView`**

En `components/ExecutiveView.tsx`, agregar a la interface de props del componente:
```ts
  funnelRespondio: import('../services/types').FunnelRespondioRow;
  responsividad: import('../services/types').ResponsividadVendedoraRow[];
```
y desestructurarlas en la firma del componente. En `App.tsx`, donde se renderiza `<ExecutiveView ... />` (tab `executive`), pasar las nuevas props desde `useDashboardData`:
```tsx
<ExecutiveView
  /* ...props existentes... */
  funnelRespondio={funnelRespondio}
  responsividad={responsividad}
/>
```
(y agregar `funnelRespondio, responsividad` a la desestructuración de `useDashboardData(...)` en `App.tsx`).

- [ ] **Step 2: Renderizar el embudo + responsividad**

En `ExecutiveView.tsx`, importar:
```ts
import EmbudoRespondio from './EmbudoRespondio';
```
Reemplazar el gráfico de embudo viejo (el `BarChart` vertical basado en `funnelCounts`/`mv_funnel_counts`) por:
```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2">
    <EmbudoRespondio funnel={funnelRespondio} />
  </div>
  <div className="bg-gray-800 rounded-xl p-6 border border-white/10">
    <h3 className="text-lg font-semibold text-gray-100 mb-1">Responsividad del equipo</h3>
    <p className="text-sm text-gray-400 mb-4">Mediana de primera respuesta</p>
    <ul className="space-y-3">
      {responsividad.slice(0, 6).map((v) => (
        <li key={v.vendedora_id} className="flex items-center justify-between">
          <span className="text-sm text-gray-300">{v.vendedora_nombre ?? 'Sin nombre'}</span>
          <span className="text-sm text-gray-100">
            <span className="font-semibold">{v.chats_respondidos}</span>
            <span className="text-gray-500"> chats · </span>
            <span className="text-gold-400">{v.resp_mediana_min !== null ? `${v.resp_mediana_min} min` : '—'}</span>
          </span>
        </li>
      ))}
    </ul>
  </div>
</div>
```
(Mantener las KPI cards existentes arriba; solo se reemplaza la sección del embudo.)

- [ ] **Step 3: Typecheck + build**

Run: `cd "Dashboard Yani Coach" && npx tsc --noEmit && npx vite build`
Expected: sin errores.

- [ ] **Step 4: Verificación visual con Playwright (Chrome ya instalado)**

Levantar dev server y validar la vista Resumen renderiza el embudo con datos reales:
```bash
cd "Dashboard Yani Coach" && npm run dev &
# esperar a que escuche en :5000, luego con el MCP de Playwright:
# browser_navigate http://localhost:5000  → login (VITE_LOCAL_AUTH_KEY) → tab "Resumen Ejecutivo"
# browser_snapshot + browser_take_screenshot
```
Expected: el embudo muestra Leads → Primer mensaje → Respondieron(★) → Interesados → Venta cerrada con counts reales (venta_cerrada ~250, no 14), % de caída, mediana de respuesta ~36 min, y la tarjeta de responsividad lista las vendedoras (Juzviachik/Vera arriba). CERO errores en consola. Capturar screenshot como evidencia.

- [ ] **Step 5: Commit**

```bash
git add components/ExecutiveView.tsx App.tsx
git commit -m "feat(fase2): vista Resumen con embudo real + responsividad mediana"
```

---

## Self-Review (post-escritura)

**Cobertura del spec (Fase 2 = portar diseño + cablear datos + corregir ventas + mediana + filtro fecha):**
- Diseño aprobado portado → Task 6 (`EmbudoRespondio`) + Task 7 (integración).
- Cablear datos reales → Tasks 3–5 (dataSource → cache → hook → vista).
- "Corregir ventas" (el verdadero bug) → Task 1 (cuenta desde tabla `ventas`) + Task 2 (re-sync del mirror stale). NO se toca `mapEstadoSimplificado` porque ya era correcto.
- Mediana en vez de media → Task 1 (`percentile_cont` en RPC y en `v_responsividad_vendedora`).
- Filtro de fecha → Task 1 (RPC `p_start`/`p_end`) + Task 3 (`getFunnelRespondio(dateRange)`) + Task 5 (recarga por rango).

**Consistencia de tipos:** `FunnelRespondioRow`, `ResponsividadVendedoraRow`, `EmbudoStage` definidos en `services/types.ts` (Tasks 3 y 4) y usados igual en dataSource, transform, cache, hook y componentes. `buildEmbudoStages` firma `(row: FunnelRespondioRow): EmbudoStage[]` usada idéntica en test y componente. Nombres de columnas del RPC (`venta_cerrada`, `tiempo_resp_mediana_min`, etc.) coinciden entre SQL (Task 1), tipo (Task 3) y test (Task 1).

**Sin placeholders:** cada step tiene código o comando concreto. Riesgo conocido: los nombres exactos de variables/promesas dentro de `cacheService.ts` y `useDashboardData.ts` (Task 5) y la sección del embudo viejo en `ExecutiveView.tsx` (Task 7) deben leerse en el archivo al implementar — los steps indican QUÉ patrón seguir y DÓNDE, porque esos archivos hay que abrirlos para insertar en el punto correcto.
