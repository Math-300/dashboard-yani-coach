# Portar mockup aprobado al Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la interfaz de producción por el mockup aprobado (`diseno-aprobado/`) al pie del detalle — sidebar de secciones, full-width, "Mi negocio hoy" — borrando todo rastro del diseño anterior y dejando todas las métricas coherentes con el filtro de fecha.

**Architecture:** Se conserva intacta la capa de datos Supabase (`dataSource.ts`, `cacheService.ts`, `useDashboardData.ts`) — ya es fechada — salvo un fix: la responsividad por vendedora se hace fechada. Se reconstruye SOLO la presentación: se portea `dashboard.css` como hoja global, se portean los componentes del mockup a TSX cableados a datos reales por props, y se borra el shell viejo (tabs, `max-w-7xl`, ExecutiveView, BusinessView, PipelineView viejo, hack de resize).

**Tech Stack:** React 19 + Vite + TypeScript + Tailwind v4 (tokens del mockup vía CSS vars) + Recharts (solo en vistas de detalle). Datos: Supabase (anon, fechado). Verificación visual: Playwright MCP contra `diseno-aprobado/screenshots/`.

**Fidelidad = contrato.** "Está bien" significa: se ve igual que `diseno-aprobado/screenshots/dashboard-hq.png` y `diseno-aprobado-full.png`, no "parecido". El JSX/CSS del mockup es la fuente de verdad del markup; este plan cablea los datos reales que el mockup tenía hardcodeados.

---

## File Structure

**Se crean:**
- `styles/yc-theme.css` — tokens + keyframes + utilidades porteados de `diseno-aprobado/dashboard.css` (verbatim).
- `components/yc/icons.tsx` — set de íconos inline del mockup (`Icons`, `Ico`) en TSX.
- `components/yc/primitives.tsx` — `Sparkline`, `PulseDot`, `MiniRow`, `useCountUp`, `useAfterMount`, `fmt`.
- `components/yc/Sidebar.tsx` — sidebar de secciones + herramientas "pronto", colapsable.
- `components/yc/Topbar.tsx` — título "Mi negocio hoy" + filtros de fecha + indicador de frescura.
- `components/yc/KpiCard.tsx` — tarjeta grande (icon, pregunta, número animado, spark, change/sub, mini-rows).
- `components/yc/Funnel.tsx` — "El camino del lead" (FunnelRow + ResultCard).
- `components/yc/EquipoCard.tsx` — "El equipo" (TeamRow).
- `components/views/ResumenView.tsx` — ensambla ActionableHint + 3 KpiCard + Funnel + EquipoCard con datos reales.
- `components/views/VentasView.tsx` — ventas re-skinneadas + Recuperación como sub-vista.
- `components/views/EquipoView.tsx` — desempeño por vendedora (lógica de PerformanceView+TeamView), UI mockup.
- `components/views/EmbudoView.tsx` — embudo "respondió" detallado, date-aware.
- `services/resumenMappers.ts` — funciones puras que mapean datos crudos → props de las tarjetas/funnel (TESTEABLES).
- `services/resumenMappers.test.ts` — tests unitarios de los mappers.
- `supabase/migrations/12_responsividad_fechada.sql` — RPC `get_responsividad(p_tenant_id, p_start, p_end)`.

**Se modifican:**
- `App.tsx` — se reescribe el shell: sidebar + topbar + ruteo de secciones, full-width. Borra tabs/`max-w-7xl`/resize-hack.
- `services/dataSource.ts` — `getResponsividad(dateRange?)` usa el nuevo RPC.
- `services/cacheService.ts:159` — pasa `dateRange` a `getResponsividad`.
- `index.css` o `index.tsx` — importa `styles/yc-theme.css`.

**Se borran (rastro del diseño anterior):**
- `components/ExecutiveView.tsx`, `components/BusinessView.tsx`, `components/RecoveryView.tsx` (su lógica de intentos migra a VentasView), `components/PipelineView.tsx` (reemplazado por EmbudoView), `components/ChatAssistant.tsx` (ya removido del shell), `components/KPICard.tsx` (reemplazado por KpiCard del mockup). `components/PerformanceView.tsx` y `TeamView.tsx` se borran una vez su lógica viva en EquipoView.

---

## Phase 0 — Backend: responsividad fechada (regla de oro)

### Task 0.1: RPC `get_responsividad` con rango de fechas

**Files:**
- Create: `supabase/migrations/12_responsividad_fechada.sql`

- [ ] **Step 1: Inspeccionar la vista actual** para clonar su lógica con filtro de fecha.

Run (Supabase MCP `execute_sql`):
```sql
select pg_get_viewdef('public.v_responsividad_vendedora'::regclass, true);
```
Expected: el SELECT que deriva `chats_respondidos` y `resp_mediana_min` por vendedora desde Chatwoot/mensajes.

- [ ] **Step 2: Escribir la función** replicando esa lógica, agregando `WHERE fecha BETWEEN p_start AND p_end` (o el campo de fecha que use la vista; usar el primer inbound/conversación). Plantilla:
```sql
create or replace function public.get_responsividad(
  p_tenant_id uuid,
  p_start timestamptz default null,
  p_end   timestamptz default null
)
returns table (
  vendedora_id text,
  vendedora_nombre text,
  chats_respondidos bigint,
  resp_mediana_min numeric
)
language sql
stable
set statement_timeout = '120s'
as $$
  -- <PEGAR el cuerpo de v_responsividad_vendedora aquí>
  -- y añadir en el WHERE: (p_start is null or <fecha_col> >= p_start)
  --                   and (p_end   is null or <fecha_col> <= p_end)
$$;
```
Nota: `set statement_timeout='120s'` por el patrón conocido (ver memoria `supabase_func_statement_timeout`).

- [ ] **Step 3: Aplicar la migración** vía Supabase MCP `apply_migration` (name `responsividad_fechada`).

- [ ] **Step 4: Verificar** que sin fechas devuelve lo mismo que la vista, y con un rango chico devuelve menos:
```sql
select * from get_responsividad('<TENANT_ID>'::uuid, null, null);
select * from get_responsividad('<TENANT_ID>'::uuid, now() - interval '7 days', now());
```
Expected: la 1ª ≈ `select * from v_responsividad_vendedora`; la 2ª con conteos menores.

- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/12_responsividad_fechada.sql
git commit -m "feat(db): get_responsividad fechado para coherencia de filtros"
```

### Task 0.2: `getResponsividad(dateRange)` en el cliente

**Files:**
- Modify: `services/dataSource.ts:398-410`
- Modify: `services/cacheService.ts:156-160`

- [ ] **Step 1:** Cambiar la firma y el cuerpo de `getResponsividad` para llamar al RPC:
```ts
export async function getResponsividad(
  dateRange?: DateRange | null,
): Promise<ResponsividadVendedoraRow[]> {
  const { data, error } = await supabase.rpc('get_responsividad', {
    p_tenant_id: TENANT_ID,
    p_start: dateRange?.start.toISOString() ?? null,
    p_end: dateRange?.end.toISOString() ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    vendedora_id: String(d.vendedora_id),
    vendedora_nombre: d.vendedora_nombre ?? null,
    chats_respondidos: Number(d.chats_respondidos ?? 0),
    resp_mediana_min: d.resp_mediana_min === null ? null : Number(d.resp_mediana_min),
  }));
}
```

- [ ] **Step 2:** En `cacheService.ts` línea ~159, pasar el rango:
```ts
const [funnelRespondio, responsividad] = await Promise.all([
  getFunnelRespondio(dateRange),
  getResponsividad(dateRange),   // ← antes sin argumento (global)
]);
```

- [ ] **Step 3:** Typecheck.
Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Commit**
```bash
git add services/dataSource.ts services/cacheService.ts
git commit -m "fix(data): responsividad respeta el filtro de fecha (regla de oro)"
```

---

## Phase 1 — Fundación visual (tokens + primitivos)

### Task 1.1: Tema global

**Files:**
- Create: `styles/yc-theme.css`
- Modify: `index.tsx` (o `index.css`) para importarlo

- [ ] **Step 1:** Copiar `diseno-aprobado/dashboard.css` **verbatim** a `styles/yc-theme.css` salvo: quitar el `html,body,#root { overflow:hidden }` (línea 35-41) porque el app real necesita scroll del documento; reemplazar por `:root`/tokens + utilidades + keyframes. Mantener `.yc-glass`, `.yc-pill`, `.yc-nav-item`, `.yc-divider`, `.yc-avatar`, `.yc-soon-badge`, `.yc-tip`, `.yc-skeleton`, `.yc-num`, `.yc-gold-text`, `.yc-scroll`, media query 1100px.

- [ ] **Step 2:** Importar en `index.tsx`: `import './styles/yc-theme.css';`. Añadir `<link>` Geist en `index.html` (`https://cdn.jsdelivr.net/npm/geist@1/...` o el que use el mockup) — si no se quiere CDN, usar fallback `system-ui` que ya está en `--font-sans`.

- [ ] **Step 3: Verificar** build: `npm run build` → sin errores CSS.

- [ ] **Step 4: Commit** `feat(ui): tema yc (tokens + glass + keyframes) del mockup`.

### Task 1.2: Íconos y primitivos

**Files:**
- Create: `components/yc/icons.tsx`, `components/yc/primitives.tsx`

- [ ] **Step 1:** Portear `Ico` + `Icons` (mockup líneas 9-155) a `icons.tsx` como TSX. Tipar props: `{ d?: string; size?: number; sw?: number; fill?: string; children?: React.ReactNode; style?: React.CSSProperties }`.

- [ ] **Step 2:** Portear a `primitives.tsx`: `useCountUp` (160-178), `useAfterMount` (181-188), `Sparkline` (193-234), `PulseDot` (237-251), `MiniRow` (254-261), `fmt` (264-268). Tipar todo. `fmt.ars` usa `toLocaleString('es-AR')`.

- [ ] **Step 3:** Typecheck: `npx tsc --noEmit` → 0 errores.

- [ ] **Step 4: Commit** `feat(ui): íconos y primitivos del mockup (Sparkline, useCountUp, fmt)`.

---

## Phase 2 — Shell nuevo (borra el anterior)

### Task 2.1: Sidebar + Topbar

**Files:**
- Create: `components/yc/Sidebar.tsx`, `components/yc/Topbar.tsx`

- [ ] **Step 1: Sidebar** — portear mockup 272-411. Cambios de cableado:
  - `metricsItems` con `active` derivado de la prop `activeSection`; `onClick` → `onSelect(id)`.
  - Footer: avatar "Y" + "Yani / cuenta personal" + botón colapsar (igual al mockup). Añadir un botón "Salir" discreto (reusar `logout()` de `services/authService`).
  - Props: `{ collapsed, onToggle, activeSection, onSelect }`.

- [ ] **Step 2: Topbar** — portear mockup 415-467. Cambios:
  - Props: `{ title?, subtitle?, range, onRangeChange, lastUpdatedLabel }`.
  - Los pills (Hoy/7 días/Este mes) llaman `onRangeChange(presetId)`; "Rango personalizado" abre el `DateRangePicker` existente (reusar `components/DateRangePicker.tsx`) o un popover. El subtítulo muestra la fecha de hoy en es-AR.
  - El indicador "Actualizado hace X" recibe `lastUpdatedLabel` (derivado del timestamp del caché).

- [ ] **Step 3:** Typecheck → 0 errores. **Commit** `feat(ui): Sidebar y Topbar del mockup`.

### Task 2.2: Reescribir `App.tsx` (shell full-width, borrar tabs)

**Files:**
- Modify (reescribe): `App.tsx`

- [ ] **Step 1:** Reemplazar `DashboardShell` por el layout del mockup (901-971): `<div flex w-full h-full>` con `<Sidebar/>` + `<main>` (Topbar + área scroll `padding 20px 32px 32px`, contenido `maxWidth 1500 margin auto`). **Eliminar:** `max-w-7xl`, la barra de tabs (84-161), el `useEffect` de resize (51-82), imports de ExecutiveView/SalesView/PerformanceView/PipelineView viejos.
- Estado: `const [section, setSection] = useState<'resumen'|'ventas'|'equipo'|'embudo'>('resumen')`.
- Mantener: `AuthProvider`/`AuthGuard`/`LoginView`/rutas (238-255), `useDashboardData(dateRange.start, dateRange.end)`, `handleDateChange`, loading/error states (re-skinneados con `.yc-skeleton`).

- [ ] **Step 2:** Ruteo de secciones en el área de contenido:
```tsx
{section === 'resumen' && <ResumenView {...data} />}
{section === 'ventas'  && <VentasView {...data} />}
{section === 'equipo'  && <EquipoView {...data} />}
{section === 'embudo'  && <EmbudoView {...data} />}
```
(En este task, las vistas que aún no existen se stubean con un `<div className="yc-glass">próximamente</div>` para que compile; se rellenan en Phase 3-4.)

- [ ] **Step 3:** Build + smoke local: `npm run build` → 0 errores; `npm run dev` y verificar que carga el shell con sidebar + topbar full-width (sin franjas laterales) y la sección Resumen stub.

- [ ] **Step 4: Commit** `feat(ui): shell nuevo full-width con sidebar de secciones; elimina tabs/max-w-7xl/resize-hack`.

---

## Phase 3 — ResumenView con datos reales

### Task 3.1: Mappers puros (testeables)

**Files:**
- Create: `services/resumenMappers.ts`, `services/resumenMappers.test.ts`

Cada mapper convierte datos crudos del hook → props de los componentes del mockup. Firmas:

```ts
import type { Sale, Seller, KpiCounts } from '../types';
import type { FunnelRespondioRow, ResponsividadVendedoraRow, EmbudoStage } from './types';

// Tarjeta "¿Cuánto vendimos?"
export function ventasCard(sales: Sale[]): {
  total: number; count: number; ticketPromedio: number;
} {
  const cerradas = sales; // 'sales' ya son ventas reales del rango
  const total = cerradas.reduce((s, v) => s + (v.amount || 0), 0);
  const count = cerradas.length;
  return { total, count, ticketPromedio: count ? Math.round(total / count) : 0 };
}

// Tarjeta "¿El equipo responde bien?"
export function respuestaCard(
  funnel: FunnelRespondioRow,
  resp: ResponsividadVendedoraRow[],
  urgentFollowUps: number,
): { medianaMin: number; sinAtender: number; porVendedora: ResponsividadVendedoraRow[] } {
  return {
    medianaMin: Math.round(funnel.tiempo_resp_mediana_min ?? 0),
    sinAtender: urgentFollowUps,
    porVendedora: resp,
  };
}

// Tarjeta "¿Dónde está la gente?"
export function leadsCard(funnel: FunnelRespondioRow): {
  respondieron: number; leadsNuevos: number; tasaRespuesta: number; llegaronVenta: number;
} {
  const tasa = funnel.leads_nuevos ? Math.round((funnel.respondieron / funnel.leads_nuevos) * 100) : 0;
  return {
    respondieron: funnel.respondieron,
    leadsNuevos: funnel.leads_nuevos,
    tasaRespuesta: tasa,
    llegaronVenta: funnel.venta_cerrada,
  };
}

// Embudo "El camino del lead" → EmbudoStage[]
export function buildEmbudo(funnel: FunnelRespondioRow): EmbudoStage[] {
  const L = funnel.leads_nuevos || 0;
  const pct = (n: number) => (L ? Math.round((n / L) * 100) : 0);
  return [
    { id: 'leads', label: 'Leads nuevos', count: funnel.leads_nuevos, pctOfLeads: 100, dropFromPrev: null },
    { id: 'primer_mensaje', label: 'Primer mensaje enviado', count: funnel.primer_mensaje, pctOfLeads: pct(funnel.primer_mensaje), dropFromPrev: 0 },
    { id: 'respondieron', label: 'Respondieron', count: funnel.respondieron, pctOfLeads: pct(funnel.respondieron), dropFromPrev: funnel.primer_mensaje ? Math.round(100 - (funnel.respondieron / funnel.primer_mensaje) * 100) : null, star: true },
    { id: 'interesados', label: 'Interesados', count: funnel.interesados, pctOfLeads: pct(funnel.interesados), dropFromPrev: funnel.respondieron ? Math.round(100 - (funnel.interesados / funnel.respondieron) * 100) : null },
    { id: 'agendo', label: 'Agendó / entró en llamada', count: null, pctOfLeads: 0, dropFromPrev: null, soon: true },
  ];
}
```

- [ ] **Step 1: Escribir los tests** (`resumenMappers.test.ts`) con casos concretos:
```ts
import { ventasCard, respuestaCard, leadsCard, buildEmbudo } from './resumenMappers';

// ventasCard: 3 ventas → total y ticket
const v = ventasCard([{ amount: 100 } as any, { amount: 200 } as any, { amount: 300 } as any]);
console.assert(v.total === 600 && v.count === 3 && v.ticketPromedio === 200, 'ventasCard');

// leadsCard: 124 de 310 → 40%
const l = leadsCard({ leads_nuevos: 310, respondieron: 124, venta_cerrada: 12 } as any);
console.assert(l.tasaRespuesta === 40 && l.llegaronVenta === 12, 'leadsCard');

// buildEmbudo: star en respondieron, soon en agendo
const e = buildEmbudo({ leads_nuevos: 310, primer_mensaje: 310, respondieron: 124, interesados: 58, venta_cerrada: 12, venta_perdida: 22, tiempo_resp_mediana_min: 18 });
console.assert(e[2].star === true && e[2].count === 124, 'embudo star');
console.assert(e[4].soon === true && e[4].count === null, 'embudo soon');

// respuestaCard: mediana redondeada + sinAtender pasa
const r = respuestaCard({ tiempo_resp_mediana_min: 18.4 } as any, [], 3);
console.assert(r.medianaMin === 18 && r.sinAtender === 3, 'respuestaCard');

console.log('OK resumenMappers');
```

- [ ] **Step 2: Correr y ver fallar** (mappers no existen aún):
Run: `npx tsx services/resumenMappers.test.ts`
Expected: error de import / assertion.

- [ ] **Step 3: Implementar** `resumenMappers.ts` (código de arriba).

- [ ] **Step 4: Correr y pasar:** `npx tsx services/resumenMappers.test.ts` → `OK resumenMappers`.

- [ ] **Step 5: Commit** `feat(resumen): mappers puros datos→tarjetas/embudo + tests`.

### Task 3.2: Componentes KpiCard, Funnel, EquipoCard

**Files:**
- Create: `components/yc/KpiCard.tsx`, `components/yc/Funnel.tsx`, `components/yc/EquipoCard.tsx`

- [ ] **Step 1: KpiCard** — portear mockup 533-598 a TSX. Props tal cual (`icon, accent, question, valueDisplay, valueRaw, change?, sub?, mini?, spark?, delay?`). Sin cambios de markup.

- [ ] **Step 2: Funnel** — portear 600-791 (`Funnel`, `FunnelRow`, `ResultCard`). Cambios de cableado:
  - `Funnel` recibe `stages: EmbudoStage[]`, `ventaCerrada: number`, `ventaPerdida: number`, `leadsNuevos: number`, `rangeLabel: string` por props (en vez de la constante `FUNNEL` y los hardcodes 310/12/22).
  - `FunnelRow` lee `stage.count`/`stage.label`/`stage.star`/`stage.soon`/`stage.pctOfLeads`/`stage.dropFromPrev`. El `max` = `leadsNuevos`. El hint se arma de `pctOfLeads`/`dropFromPrev` (texto humano: "contestaron X% · se enfriaron N").
  - `ResultCard` recibe `target` por prop (no hardcode 12/22).

- [ ] **Step 3: EquipoCard** — portear 800-868 (`EquipoCard`, `TeamRow`). Cambios:
  - `EquipoCard` recibe `team: { name; chats; time; color; tone }[]` y `sinAtender: number` por props. Derivar `team` de `ResponsividadVendedoraRow[]` (nombre, `chats_respondidos`, `resp_mediana_min`), asignando color por orden (mejor mediana = verde, resto = gold).

- [ ] **Step 4:** Typecheck → 0 errores. **Commit** `feat(ui): KpiCard, Funnel y EquipoCard del mockup (props reales)`.

### Task 3.3: ResumenView (ensamble + datos reales)

**Files:**
- Create: `components/views/ResumenView.tsx`
- Modify: `App.tsx` (reemplaza el stub de resumen)

- [ ] **Step 1:** Crear `ResumenView` que recibe del hook: `sales, funnelRespondio, responsividad, kpiCounts, sellers, dateRange, cacheTimestamp`. Estructura = mockup 910-966:
  - `ActionableHint` (mockup 471-529): texto real = `kpiCounts.urgentFollowUps` leads sin atender; botón "Ver chats" (link a Chatwoot o no-op por ahora). Si `urgentFollowUps === 0`, ocultar el hint.
  - 3 `KpiCard` cableadas con `ventasCard(sales)`, `respuestaCard(funnelRespondio, responsividad, kpiCounts.urgentFollowUps)`, `leadsCard(funnelRespondio)`. Los sparklines: si no hay serie temporal real disponible, usar una serie derivada simple (p. ej. repartir el total en los días del rango) — NO inventar tendencia; si no hay datos, omitir el spark (prop opcional).
  - `Funnel` con `buildEmbudo(funnelRespondio)` + `venta_cerrada`/`venta_perdida`/`leads_nuevos` + `rangeLabel`.
  - `EquipoCard` con `responsividad` → team + `sinAtender = kpiCounts.urgentFollowUps`.

- [ ] **Step 2:** En `App.tsx`, reemplazar el stub: `<ResumenView .../>` con las props del hook.

- [ ] **Step 3:** Build + `npm run dev`. Verificar contra `diseno-aprobado-full.png`: 3 tarjetas arriba, funnel 2/3 izq + equipo 1/3 der, números reales (no hardcodes).

- [ ] **Step 4: Commit** `feat(resumen): ResumenView cableado a datos reales fechados`.

---

## Phase 4 — Secciones de detalle (re-skin) + borrado del diseño viejo

### Task 4.1: EmbudoView (reemplaza PipelineView)

**Files:**
- Create: `components/views/EmbudoView.tsx`

- [ ] **Step 1:** Vista de embudo detallada usando `Funnel` (reuso) + un desglose: tabla/listado de etapas con conteos y % (de `buildEmbudo(funnelRespondio)`), todo del rango. Reusar `components/EmbudoRespondio.tsx` si aporta (revisar su contenido primero). UI con `.yc-glass`.

- [ ] **Step 2:** En `App.tsx`, montar `<EmbudoView/>`. Build + verificar. **Commit** `feat(embudo): EmbudoView date-aware reemplaza Pipeline`.

### Task 4.2: EquipoView (fusión Performance+Team)

**Files:**
- Create: `components/views/EquipoView.tsx`

- [ ] **Step 1:** Portear la lógica de datos de `PerformanceView.tsx`/`TeamView.tsx` (ventas por vendedora, ranking, responsividad) a una vista nueva con UI del mockup (`.yc-glass`, avatares, mini-bars como `TeamRow`). Recibe `sellers`, `responsividad`, `sales` del hook. Charts (si los hay) con contenedores de ancho real y márgenes que no se monten.

- [ ] **Step 2:** `App.tsx` monta `<EquipoView/>`. Build + verificar. **Commit** `feat(equipo): EquipoView (desempeño + responsividad) UI mockup`.

### Task 4.3: VentasView (+ Recuperación)

**Files:**
- Create: `components/views/VentasView.tsx`

- [ ] **Step 1:** Portear la lógica de `SalesView.tsx` (ingresos, ventas por período/producto) a UI del mockup. Sub-vista "Recuperación" (lógica de `RecoveryView.tsx`: intentos de compra, dinero recuperado) como pestaña/sección interna dentro de Ventas. Recibe `sales`, `attempts`. Charts re-skinneados, sin texto encimado.

- [ ] **Step 2:** `App.tsx` monta `<VentasView/>`. Build + verificar. **Commit** `feat(ventas): VentasView + Recuperación, UI mockup`.

### Task 4.4: Borrar el diseño anterior

**Files:**
- Delete: `components/ExecutiveView.tsx`, `components/BusinessView.tsx`, `components/PipelineView.tsx`, `components/PerformanceView.tsx`, `components/TeamView.tsx`, `components/RecoveryView.tsx`, `components/KPICard.tsx`, `components/ChatAssistant.tsx` (si sigue en repo).

- [ ] **Step 1:** Confirmar que NINGÚN import vivo apunta a esos archivos:
Run: `grep -rn -E "ExecutiveView|BusinessView|PipelineView|PerformanceView|TeamView|RecoveryView|KPICard|ChatAssistant" App.tsx components/ services/ hooks/ --include=*.tsx --include=*.ts`
Expected: solo coincidencias dentro de los propios archivos a borrar (o ninguna).

- [ ] **Step 2:** Borrar los archivos. `git rm <archivos>`.

- [ ] **Step 3:** `npx tsc --noEmit` + `npm run build` → 0 errores (prueba de que no quedó rastro referenciado).

- [ ] **Step 4: Commit** `chore(ui): borrar vistas del diseño anterior (sin rastro)`.

---

## Phase 5 — Gráficos sin texto encimado

### Task 5.1: Auditar y arreglar charts de las vistas de detalle

**Files:**
- Modify: `components/views/VentasView.tsx`, `EquipoView.tsx`, `EmbudoView.tsx` (según dónde haya Recharts)

- [ ] **Step 1:** Para cada `<ResponsiveContainer>`: asegurar `width="100%"` + `height` fijo (≥260px), `margin={{ top, right, bottom, left }}` con bottom/left suficientes para labels; ejes con `tick={{ fontSize: 11 }}`, `interval="preserveStartEnd"` o `angle`/`textAnchor` en XAxis si las etiquetas son largas; leyendas fuera del área de plot. Sin el hack de `resize` (ya eliminado en Phase 2).

- [ ] **Step 2:** Verificación visual (Phase 6) confirma cero solapamientos.

- [ ] **Step 3: Commit** `fix(charts): márgenes/ejes/leyendas sin solapamiento`.

---

## Phase 6 — Verificación real y deploy

### Task 6.1: Prueba en navegador (Playwright) — fidelidad + coherencia de fecha

- [ ] **Step 1:** `npm run dev`. Con Playwright MCP: login, navegar las 4 secciones. Screenshot de cada una a 1440px y 1024px de ancho.

- [ ] **Step 2: Fidelidad:** comparar Resumen contra `diseno-aprobado/screenshots/dashboard-hq.png` y `diseno-aprobado-full.png`. Checklist: sidebar (Resumen/Ventas/Equipo/Embudo + Herramientas "pronto"), full-width sin franjas vacías, "Mi negocio hoy", 3 tarjetas, "El camino del lead", "El equipo". Ajustar discrepancias.

- [ ] **Step 3: Coherencia de fecha (arregla reclamo #1):** cambiar filtro Hoy → 7 días → Este mes → Rango. Verificar que **TODOS** los números cambian de forma consistente (ventas, respuesta del equipo, embudo, tarjetas). Ningún valor congelado sin etiqueta de "histórico".

- [ ] **Step 4:** Consola: 0 errores. `browser_console_messages` limpio.

- [ ] **Step 5: Commit** (si hubo ajustes) `fix(ui): ajustes de fidelidad tras verificación en navegador`.

### Task 6.2: Build, deploy al VPS y verificación en producción

- [ ] **Step 1:** `npm run build` local OK. Pushear la rama.

- [ ] **Step 2:** En el VPS (`/opt/dashboard-yani-coach`): `git pull`, reconstruir imagen web y forzar update (patrón conocido, ver memoria `swarm_local_image_force_update`):
```bash
docker build -t yani-dashboard-web:local -f Dockerfile.web .
docker service update --force --image yani-dashboard-web:local yani-dashboard_yani_dashboard_web
```

- [ ] **Step 3:** Verificar producción: `curl -sI https://dashboard.yanicoach.com` → 200; Playwright sobre la URL pública: las 4 secciones, fidelidad, 0 errores de consola, filtros coherentes.

- [ ] **Step 4:** Confirmar al usuario con evidencia (screenshots prod vs mockup). Actualizar memoria `dashboard_produccion_deploy` con el nuevo diseño desplegado.

---

## Notas de ejecución para subagentes
- **Fidelidad primero:** ante duda de markup/estilo, copiar del mockup, no improvisar.
- **Datos reales, cero mocks:** si una fuente no tiene dato (p. ej. serie de sparkline), omitir el elemento opcional u mostrar el valor real disponible — nunca inventar. Errores visibles, nunca silenciosos (regla del proyecto).
- **Commits frecuentes** por task. Rama actual: `feature/fase1-senal-respondio`.
- **No tocar** la operación n8n ni los workflows; esto es solo lectura/presentación.
