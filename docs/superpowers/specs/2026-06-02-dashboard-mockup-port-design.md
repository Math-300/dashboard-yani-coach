# Diseño — Portar el mockup aprobado al Dashboard de producción

_Fecha: 2026-06-02 · Estado: propuesto, pendiente de OK del usuario_

## Problema (diagnóstico, con evidencia)

El dashboard en producción (https://dashboard.yanicoach.com) **NO** corre el mockup
aprobado por Yani. Corre la interfaz anterior. Reclamos del usuario, cada uno con causa raíz:

1. **Diseño equivocado.** `App.tsx:84-89` arma 4 *tabs* técnicos
   (Resumen Ejecutivo / Ventas & Ingresos / Desempeño Vendedoras / Pipeline & Actividad).
   El mockup aprobado (`diseno-aprobado/dashboard.jsx` + `screenshots/`) es un **sidebar de
   secciones** + pantalla "Mi negocio hoy". El mockup nunca se portó al app real.
2. **Desperdicio de pantalla.** `App.tsx:100` y `App.tsx:166` usan `max-w-7xl mx-auto`
   → contenido encajonado en 1280px centrados. El mockup es full-width con sidebar.
3. **Datos "no se sienten reales" al filtrar fecha — bug real de coherencia.**
   - SÍ respetan la fecha: ventas, leads, embudo "respondió" (`dataSource.ts:290-395`, RPCs con `p_start/p_end`).
   - **NO** respetan la fecha: el embudo principal por estado (`getFunnelCounts`, `dataSource.ts:279-288`,
     lee `mv_funnel_counts` global) y la responsividad del equipo (`getResponsividad`, `dataSource.ts:398`, global).
   - Resultado: unos números se mueven con el filtro y otros se congelan → se siente incoherente.
   - Además el embudo viejo usa `estado_actual` (estado de HOY), que **no es** una métrica de rango.
4. **Texto encimado en gráficos.** `App.tsx:51-82` tiene un *hack* de `resize` manual: cicatriz
   de charts mal dimensionados en contenedores apretados.

## Principio rector #0 — FIDELIDAD AL MOCKUP (directiva explícita del usuario)

**El mockup aprobado (`diseno-aprobado/dashboard.jsx` + `dashboard.css` + `screenshots/`) es el
contrato visual. Se replica al pie del detalle.** Directiva textual del usuario (2026-06-02):
_"sigue al pie del detalle el diseño y mockup que te pasé… borra cualquier rastro del anterior,
enfócate en este."_

Implica:
- Se **elimina por completo** la interfaz anterior: el shell de `App.tsx` (tabs, `max-w-7xl`, header viejo,
  hack de `resize`), y las vistas que no existen en el mockup como pantallas propias.
- **No sobrevive ningún chrome visual del diseño viejo.** Las vistas de detalle que se conserven
  (Ventas, Equipo, Embudo, Recuperación) se **re-skinnean** al lenguaje visual del mockup —
  no se reusa su layout/estilo anterior, solo su lógica de datos.
- La referencia de "está bien" es: **se ve igual que los screenshots del mockup**, no "parecido".

## Usuaria y principio rector

Yani **no es técnica**. La claridad es la regla #1: lenguaje humano, números grandes, sin jerga.
(Ver `.brain/diseno_dashboard_metricas_v1_2026-05-27.md`.)

## Decisiones del usuario (esta sesión)

- **Alcance:** portar el mockup aprobado (sidebar de secciones, full-width, "Mi negocio hoy") y
  conservar las vistas técnicas actuales como **detalle accesible** dentro de cada sección.
- **Vistas viejas:** *jubilar* Ejecutiva y Negocio (redundantes con el nuevo Resumen);
  conservar Recuperación como **sub-vista de Ventas** (es dinero recuperado).

## Diseño

### A) Shell nuevo
- **Sidebar fijo** (porteado de `dashboard.jsx`/`dashboard.css`):
  - `MÉTRICAS`: **Resumen · Ventas · Equipo · Embudo**
  - `HERRAMIENTAS · próximamente`: **Plantillas · Masivos WhatsApp · Clientes** (deshabilitados, badge "PRONTO")
  - Pie: "Yani · cuenta personal" + botón salir. Colapsable.
- **Ancho completo:** se elimina `max-w-7xl`; padding sano, el contenido usa toda la pantalla.
- **Barra superior:** "Mi negocio hoy" + subtítulo con fecha · filtros (Hoy · 7 días · Este mes · Rango)
  · indicador "Actualizado hace X · se refresca solo".

### B) Secciones (mapeo)
| Sección | Contenido | Fuente de datos |
|---|---|---|
| **Resumen** (nuevo) | 3 tarjetas grandes ("¿Cuánto vendiste?" · "¿El equipo responde bien?" · "¿Cuántos leads?") + "El camino del lead" (embudo) + "El equipo" | `funnelRespondio`, `kpiCounts`, `sales`, `responsividad` — **todo fechado** |
| **Ventas** | Ventas re-skinneadas al mockup, full-width + charts arreglados; Recuperación como sub-vista | `sales`, `attempts` |
| **Equipo** | Desempeño por vendedora (lógica de PerformanceView+TeamView) con UI nueva del mockup | `sellers`, `responsividad` |
| **Embudo** | Embudo "respondió" detallado, date-aware (reemplaza Pipeline viejo), UI del mockup | `get_funnel_respondio` |

**Se conserva la LÓGICA DE DATOS de las vistas de detalle, NO su UI.** Cada sección se construye con el
lenguaje visual del mockup. Jubiladas por completo (código y UI): ExecutiveView, BusinessView
(su rol lo cubre el nuevo Resumen). RecoveryView: su lógica pasa a sub-vista de Ventas, re-skinneada.

### C) Regla de oro de datos (arregla reclamo #3)
**Todo número en pantalla respeta el filtro de fecha activo.**
- Se retira el embudo global por `estado_actual` de la UI; el embudo pasa a ser el fechado (`get_funnel_respondio`).
- La responsividad del equipo se hace **fechada** (extender `get_responsividad` / `v_responsividad_vendedora`
  para aceptar `p_start/p_end`, o derivarla de datos fechados). Si algún número es intencionalmente
  histórico/total, se etiqueta explícitamente como tal — nunca se deja ambiguo.

### D) Gráficos (arregla reclamo #4)
- Reconstruir con contenedores de ancho real, márgenes y leyendas que no se monten.
- Eliminar el *hack* de `resize` de `App.tsx:51-82`.
- Verificación visual real en navegador antes de dar OK.

### E) Estrategia técnica
- **No se toca la capa de datos** (Supabase: `dataSource.ts`, `cacheService.ts`, `useDashboardData.ts`).
  Ya funciona y es fechada — salvo el agregado `get_funnel_respondio` y la responsividad que se hacen
  fuente única del embudo/respuesta.
- Se reconstruye **solo la presentación**: `App.tsx` (shell + sidebar + ruteo de secciones),
  nueva `ResumenView`, y remapeo de las vistas de detalle. Se portea el estilo del mockup
  (`diseno-aprobado/dashboard.css`) al tema Tailwind gold existente.
- Stack intacto: React 19 + Vite + TS + Tailwind + Recharts.

## Componentes (unidades, una responsabilidad cada una)
- **`AppShell`** (en `App.tsx`): layout sidebar + topbar + área de contenido full-width; estado de
  sección activa; filtro de fecha. Depende de `useDashboardData`.
- **`Sidebar`**: navegación de secciones + herramientas "pronto". Sin lógica de datos.
- **`TopBar`**: título, filtros de fecha, indicador de frescura.
- **`ResumenView`** (nuevo): 3 `BigMetricCard` + `CaminoDelLead` (embudo) + `EquipoPanel`.
  Todo recibe datos ya fechados por props; sin fetching propio.
- **Vistas de detalle** (lógica reusada, UI nueva del mockup): `VentasView` (+ Recuperación),
  `EquipoView` (lógica de `PerformanceView`+`TeamView`), `EmbudoView` (sobre `EmbudoRespondio`).
  Los componentes viejos (`ExecutiveView`, `BusinessView`, `PipelineView` viejo, shell de tabs) se borran.

## Manejo de errores
- Se mantiene la regla actual: **errores visibles, nunca mocks**. Si una fuente falla, la UI muestra
  el fallo (no datos viejos disfrazados de frescos). Para Yani, mensaje humano + último dato bueno con
  "actualizado hace X" donde aplique.

## Pruebas
- **Prueba visual real en navegador** (Playwright) de las 4 secciones, en al menos 2 anchos de pantalla,
  verificando: full-width sin franjas vacías, sin texto encimado en gráficos, sidebar correcto.
- **Prueba de coherencia de fecha:** cambiar el filtro (Hoy / 7 días / Este mes / Rango) y verificar que
  **todos** los números se mueven de forma consistente (ningún congelado sin etiqueta).
- 0 errores de consola.

## Fuera de alcance
- "Agendó/asistió llamada" (Calendly) → Fase 2. En el embudo queda el hueco visible "pronto".
- "Valor del Pipeline" si `estimated_value` sigue vacío en NocoDB → se muestra honesto, no inventado.
- Multi-tenant real → futuro.

## Entrega
- Build local → imagen `:local` → `docker service update --force --image` en el VPS
  (ver `[[swarm_local_image_force_update]]`). Verificación en producción antes de cerrar.

## Referencias
- Mockup: `diseno-aprobado/dashboard.jsx`, `dashboard.css`, `screenshots/`.
- `.brain/diseno_dashboard_metricas_v1_2026-05-27.md` (objetivo Fase 1, embudo de Yani).
- `[[dashboard_produccion_deploy]]`, `[[swarm_local_image_force_update]]`, `[[chatwoot_sync_full_scan_load]]`.
