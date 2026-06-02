# Claridad de tarjetas "Mi negocio hoy" + filtro "Mes pasado" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las 3 tarjetas del resumen se entiendan de un vistazo (número héroe con etiqueta clara, subtítulos legibles, tiempo en formato "1h 59m") y que el filtro "Mes pasado" sea un pill rápido en el Topbar.

**Architecture:** Cambios puramente de presentación + un helper de formato puro. Cero cambios en RPCs, sync o datos. El número héroe de la tarjeta de leads pasa a ser la fracción "40 de 79" reusando `valueRaw`/`valueDisplay` de `KpiCard` (el `40` anima, "de 79" es texto). El tiempo usa un nuevo `formatDuration` puro y testeado.

**Tech Stack:** React 19 + TS + Vite. Tests: `npx tsx <archivo>.test.ts` con `console.assert` (mismo estilo que `services/resumenMappers.test.ts`).

**Decisión de fechas (tomada):** se deja el manejo de fecha tal cual (aproximado por mes); NO se refactoriza zona horaria en este plan.

---

### Task 1: Helper de formato de duración (`formatDuration`)

**Files:**
- Create: `services/format.ts`
- Test: `services/format.test.ts`
- Modify: `components/yc/primitives.tsx` (agregar `dur` al objeto `fmt`)

- [ ] **Step 1: Escribir el test que falla** — `services/format.test.ts`

```ts
import { formatDuration } from './format';

console.assert(formatDuration(0) === '0 min', `0 → ${formatDuration(0)}`);
console.assert(formatDuration(8) === '8 min', `8 → ${formatDuration(8)}`);
console.assert(formatDuration(45) === '45 min', `45 → ${formatDuration(45)}`);
console.assert(formatDuration(59) === '59 min', `59 → ${formatDuration(59)}`);
console.assert(formatDuration(60) === '1h', `60 → ${formatDuration(60)}`);
console.assert(formatDuration(119) === '1h 59m', `119 → ${formatDuration(119)}`);
console.assert(formatDuration(118.7) === '1h 59m', `118.7 → ${formatDuration(118.7)}`); // redondea
console.assert(formatDuration(120) === '2h', `120 → ${formatDuration(120)}`);
console.assert(formatDuration(125) === '2h 5m', `125 → ${formatDuration(125)}`);
console.assert(formatDuration(598) === '9h 58m', `598 → ${formatDuration(598)}`);

console.log('OK format');
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx tsx services/format.test.ts`
Expected: FAIL (no existe `./format`).

- [ ] **Step 3: Implementación mínima** — `services/format.ts`

```ts
/**
 * Formatea minutos a un string humano:
 *   8   → "8 min"
 *   59  → "59 min"
 *   60  → "1h"
 *   119 → "1h 59m"
 *   125 → "2h 5m"
 * Redondea al minuto. Negativos o NaN → "0 min".
 */
export function formatDuration(min: number): string {
  if (!Number.isFinite(min) || min < 0) return '0 min';
  const total = Math.round(min);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx tsx services/format.test.ts`
Expected: `OK format`, exit 0.

- [ ] **Step 5: Exponer `fmt.dur`** en `components/yc/primitives.tsx`

En el objeto `fmt` (cerca de la línea 170), importar arriba del archivo:
```ts
import { formatDuration } from '../../services/format';
```
y agregar dentro de `fmt`:
```ts
  dur: (n: number) => formatDuration(n),
```
(dejar `min` como está; no romper consumidores existentes.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add services/format.ts services/format.test.ts components/yc/primitives.tsx
git commit -m "feat: formatDuration helper (1h 59m) + fmt.dur"
```

---

### Task 2: Claridad de las 3 tarjetas (número héroe + subtítulos)

**Files:**
- Modify: `components/yc/KpiCard.tsx` (legibilidad del subtítulo)
- Modify: `components/views/ResumenView.tsx` (las 3 tarjetas)

Depende de Task 1 (`formatDuration`).

- [ ] **Step 1: Subtítulo legible en `KpiCard.tsx`**

En el bloque `{!change && sub && (...)}` (≈ línea 96-98), cambiar el estilo del subtítulo de:
```tsx
<span style={{ fontSize: 12.5, color: 'var(--yc-text-faint)' }}>{sub}</span>
```
a:
```tsx
<span style={{ fontSize: 13, color: 'var(--yc-text-mute)', lineHeight: 1.35 }}>{sub}</span>
```
(Esto aplica parejo a las 3 tarjetas porque todas pasan por `KpiCard`.)

- [ ] **Step 2: Tarjeta VENTAS — subtítulo "en N ventas"** en `ResumenView.tsx`

En la `<KpiCard>` de `question="¿Cuánto vendimos?"`, reemplazar la prop `sub`:
```tsx
sub={ventas.count === 0
  ? 'sin ventas en el período'
  : `en ${ventas.count} ${ventas.count === 1 ? 'venta' : 'ventas'}`}
```

- [ ] **Step 3: Tarjeta EQUIPO — tiempo "1h 59m"** en `ResumenView.tsx`

Importar el helper arriba:
```tsx
import { formatDuration } from '../../services/format';
```
En la `<KpiCard>` de `question="¿El equipo responde bien?"`:
- cambiar `valueDisplay={(v) => \`${Math.round(v)} min\`}` por `valueDisplay={(v) => formatDuration(v)}`
- cambiar `sub="tiempo promedio en contestar al lead"` por `sub="tardan en contestar al lead"`

Y en `respMini` (las filas por vendedora, ≈ línea 188-191), cambiar:
```tsx
value: `${Math.round(r.resp_mediana_min ?? 0)} min · ${r.chats_respondidos} chats`,
```
por:
```tsx
value: `${formatDuration(r.resp_mediana_min ?? 0)} · ${r.chats_respondidos} chats`,
```

- [ ] **Step 4: Tarjeta LEADS — héroe "40 de 79" + pregunta + subtítulo** en `ResumenView.tsx`

En la `<KpiCard>` de la tercera tarjeta:
- `question="¿Dónde está la gente?"` → `question="¿Cuántos respondieron?"`
- agregar `valueDisplay` como fracción (el `valueRaw={leads.respondieron}` ya anima el 40):
```tsx
valueDisplay={(n) => `${fmt.num(n)} de ${fmt.num(leads.leadsNuevos)}`}
```
  (reemplaza el `valueDisplay={fmt.num}` actual)
- `sub={`${leads.respondieron} respondieron de ${leads.leadsNuevos} nuevos`}` → `sub="leads nuevos te contestaron"`

(NO tocar `valueRaw`, `mini`, ni `spark`.)

- [ ] **Step 5: Typecheck + correr tests de mappers (no deben romperse)**

Run: `npx tsc --noEmit && npx tsx services/resumenMappers.test.ts`
Expected: sin errores TS; `OK resumenMappers`.

- [ ] **Step 6: Commit**

```bash
git add components/yc/KpiCard.tsx components/views/ResumenView.tsx
git commit -m "feat: tarjetas resumen mas claras (fraccion leads, 1h 59m, subtitulos legibles)"
```

---

### Task 3: Filtro "Mes pasado" como pill + etiquetas de rango correctas

**Files:**
- Modify: `components/yc/Topbar.tsx` (pill nuevo)
- Modify: `App.tsx` (mapeos de preset)
- Modify: `components/views/ResumenView.tsx` (`presetToLabel`)

- [ ] **Step 1: Pill "Mes pasado" en `Topbar.tsx`**

```tsx
const PILL_PRESET_MAP: Record<string, DateRangePreset> = {
  today: 'today',
  '7d': 'week',
  month: 'month',
  last_month: 'last_month',
};

const PILL_LABELS: Record<string, string> = {
  today: 'Hoy',
  '7d': 'Últimos 7 días',
  month: 'Este mes',
  last_month: 'Mes pasado',
};

const PILL_IDS = ['today', '7d', 'month', 'last_month'] as const;
```

- [ ] **Step 2: Mapeos en `App.tsx`**

En el init de `activePresetId` (≈ línea 59-66), agregar antes del `custom`:
```tsx
    if (preset === 'last_month') return 'last_month';
```
En `handleRangeChange`, en el `presetMap` (≈ línea 90-95), agregar:
```tsx
      last_month: 'last_month',
```

- [ ] **Step 3: `presetToLabel` completo en `ResumenView.tsx`**

Reemplazar la función `presetToLabel` por:
```tsx
function presetToLabel(presetId: string): string {
  switch (presetId) {
    case 'today': return 'hoy';
    case 'yesterday': return 'ayer';
    case '7d':
    case 'week': return 'últimos 7 días';
    case 'last_30_days': return 'últimos 30 días';
    case 'month': return 'este mes';
    case 'last_month': return 'mes pasado';
    case 'last_6_months': return 'últimos 6 meses';
    default: return 'período seleccionado';
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add components/yc/Topbar.tsx App.tsx components/views/ResumenView.tsx
git commit -m "feat: pill 'Mes pasado' en topbar + etiquetas de rango"
```

---

## Verificación final (controller)

- [ ] `npx tsc --noEmit` limpio
- [ ] `npx tsx services/format.test.ts` y `services/resumenMappers.test.ts` → OK
- [ ] Build web + deploy al VPS (force-update, imagen `:local`) y verificar en vivo: tarjeta leads muestra "40 de 79", tiempo "1h 59m", pill "Mes pasado" filtra mayo (234 ventas / $6.150).
