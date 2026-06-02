# Claridad Fase 2 — textos legibles, tiempos humanos, bug categorías + embudo claro

> Ejecutado con subagentes Sonnet (archivos disjuntos, en paralelo). El controller audita, buildea y deploya.

**Goal:** Que Yani entienda cada número de un vistazo: textos legibles, tiempos en formato hora con "N respuestas", arreglar el bug de "Ingresos por categoría" (mostraba 99% en "Otros"), y wording de negocio en equipo y embudo.

**Decisiones del usuario (2026-06-02):**
1. Tiempo de respuesta → mostrar "1h 26m · 288 respuestas" (el crecimiento al ampliar filtro es CORRECTO, no bug; "Hoy" con n=4 es ruido).
2. Categorías → nombres tal cual la base: Programa PREMIUM / Producto Digital / Paquete Low cost.
3. Etiquetas equipo → lenguaje simple: toques→"mensajes para cerrar", antigüedad→"días esperando", activos→"leads abiertos", ciclo→"días hasta la venta".
4. Embudo → lenguaje de negocio: "personas · % del total · cuántas se perdieron"; Leads→Personas nuevas; Primer mensaje enviado→El equipo las contactó.

---

### Task A — Equipo: tiempo humano + "respuestas" + etiquetas simples
**Files:** `components/yc/primitives.tsx`, `components/views/EquipoView.tsx`, `components/yc/EquipoCard.tsx`
- primitives.tsx:174 → `min: (n: number) => formatDuration(n),` (formatDuration ya está importado vía línea 3; `dur` ya existe). Esto vuelve humano todo `fmt.min`.
- EquipoView.tsx: donde diga "chats" como unidad de respuestas (líneas ~232 card "{chats} chats", ~352 "...· {chats} chats") → "respuestas".
- EquipoView.tsx etiquetas: "activos"→"leads abiertos" (~188), "ciclo {d}d"→"{d}d hasta la venta" (~193). Tabla detalle headers/badges: "Toques/cierre"→"Mensajes para cerrar", "Antigüedad activa"→"Días esperando", "Ciclo venta"→"Días hasta la venta", "activos" col→"Leads abiertos" (~781,868,891,908).
- EquipoCard.tsx:51 "{chats} chats" → "{chats} respuestas".
- NO commitear. Correr `npx tsc --noEmit` (debe quedar limpio) y verificar visualmente no romper mini-bars.

### Task C — Embudo: wording de negocio
**Files:** `services/resumenMappers.ts`, `components/views/EmbudoView.tsx`, `components/yc/Funnel.tsx`
- resumenMappers.ts buildEmbudo (líneas ~63-67): "Leads nuevos"→"Personas nuevas"; "Primer mensaje enviado"→"El equipo las contactó". Dejar "Respondieron", "Interesados", "Agendó / entró en llamada".
- EmbudoView.tsx:299 leyenda "conteo · % del total · caída del paso anterior" → "cantidad · % del total · cuántas se perdieron".
- EmbudoView.tsx headers tabla (~315-325): "Leads"→"Personas", "Caída"→"Se perdieron". (Etapa, % total quedan.)
- Funnel.tsx: donde diga "se cayeron N" / anotación inter-etapa negativa → "no siguieron N". Mantener "todas siguen" pero sin flecha ↓ contradictoria si aparece.
- NO commitear. `npx tsc --noEmit` limpio.

### Task D — Bug Ingresos por categoría (usar Tipo de Oferta real)
**Files:** `services/dataSource.ts`, `types.ts`, `services/metricsCalculator.ts`, `components/views/VentasView.tsx`
- dataSource.ts getSales (~196): agregar `raw` al `.select(...)`. En el map (~211) agregar `category: (s.raw as any)?.['Tipo de Oferta'] || undefined,`.
- types.ts Sale interface (~77): agregar `category?: string; // Tipo de Oferta del CRM`.
- metricsCalculator.ts calculateRevenueByCategory (~389-411): reemplazar `inferCategory(sale.productName)` por `sale.category || 'Sin categoría'`. Eliminar/dejar sin uso `inferCategory` (borrarla para no dejar código muerto).
- VentasView.tsx leyenda del PieChart (~444-446): subir contraste del label (usar `--yc-text` o `--yc-text-mute`, no faint; fontSize ≥12).
- Verificar: build + que aparezcan Programa PREMIUM / Producto Digital / Paquete Low cost con montos reales (302/$7.538, 122/$9.676, 2/$194).
- NO commitear. `npx tsc --noEmit` limpio.

### Task E — Legibilidad global
**Files:** `styles/yc-theme.css`
- Línea 16: `--yc-text-mute: rgba(240, 234, 218, 0.58)` → `0.72`.
- Línea 17: `--yc-text-faint: rgba(240, 234, 218, 0.32)` → `0.52`.
- Un solo cambio que sube el contraste de TODOS los textos tenues del dashboard.
- NO commitear.

---

## Verificación final (controller)
- Auditar cada diff con git/grep (no confiar en el reporte del subagente).
- `npx tsc --noEmit` limpio; `npx tsx services/format.test.ts` y `services/resumenMappers.test.ts` y `services/funnelTransform.test.ts` → OK.
- Wording extra: ResumenView respMini "chats"→"respuestas" (lo hace el controller).
- `npx vite build` 0 errores.
- Commit único + deploy VPS (rebuild + `docker service update --force`).
- Playwright en vivo: tiempos "1h 26m · 288 respuestas", categorías 3 reales, embudo "El equipo las contactó", textos legibles.
