# Plan de Arquitectura de Data — 2026-04-18

## Para quién es este documento

Para la próxima sesión de Claude (o cualquier dev humano) que vaya a trabajar en mejorar el Dashboard. Lee primero `.brain/decisiones_arquitectura_data.md` para entender el contexto y las decisiones tomadas con Yani. Después lee `.brain/bugs_metricas_conocidos.md` para saber qué está roto. Este archivo es el **roadmap de ejecución**.

## Fases

### Fase 1 — Auditar y arreglar bugs actuales

**Objetivo**: que todas las métricas que hoy muestra el Dashboard sean confiables.

**Pasos concretos**:

1. Levantar el Dashboard localmente con `.env.local`. Abrir cada vista.
2. Usar `.brain/bugs_metricas_conocidos.md` como checklist.
3. Ir arreglando en orden:
   - Conversion rate edge case (`metricsCalculator.ts:182`).
   - Marcar tendencias simuladas en UI o quitarlas.
   - Recovery metrics: aclarar definición del KPI.
   - Paginación: subir límite y loggear.
   - Fallback demo: agregar banner.
   - Timezone: centralizar conversión.
4. Aplicar optimizaciones de performance:
   - Columnas formula en NocoDB: `Is_Active`, `Days_In_Pipeline`, `Month_Sold`, `Is_This_Month`.
   - Reducir 15 requests de funnel counts a ~5 con agregaciones.
5. Correr `scripts/validate_metrics.ts` y arreglar los diffs.

**Criterio de cierre**: Yani abre el Dashboard, cada KPI tiene número real o dice "no disponible" explícito. Nada de datos ocultos ni silenciosos.

**Tiempo estimado**: 3-5 días de trabajo focal.

---

### Fase 2 — Diseñar y construir capa de caché

**Objetivo**: Dashboard deja de consultar NocoDB directo. Consulta solo la capa de caché.

**Decisiones a cerrar al iniciar esta fase**:

- **Tecnología**: Supabase (recomendado, ver `decisiones_arquitectura_data.md`), Postgres en VPS, Redis-only.
- **Ubicación del sincronizador**: n8n workflow cada 5 min, cron en Vercel, Supabase Edge Function.
- **Estrategia de sync**: full-refresh cada N min, incremental por `UpdatedAt`, event-driven por webhooks.

**Pasos concretos**:

1. PoC: sincronizar solo tabla `Contactos` NocoDB → Supabase cada 5 min. Medir tiempo, costo, confiabilidad.
2. Definir schema:
   - Tablas espejo 1:1 de NocoDB.
   - Vistas materializadas para KPIs pesados (funnel counts, conversión por vendedora, tendencias por mes).
3. Crear `services/dataSource.ts` con interfaz agnóstica (el Dashboard no debería saber si la data viene de NocoDB o de caché).
4. Migrar cada view component a usar `dataSource.ts` en vez de `noco.ts`.
5. Deprecar o mantener como fallback `api/nocodb/[...table].ts`.
6. Medir: requests por página <5, carga inicial <1s.

**Criterio de cierre**: Dashboard funciona idéntico pero desde caché. Rate limit de NocoDB ya no afecta.

**Tiempo estimado**: 1-2 semanas.

---

### Fase 3 — Sumar Chatwoot como segunda fuente

**Objetivo**: habilitar métricas operativas que hoy no existen en el Dashboard.

**Métricas a habilitar** (confirmadas por Yani):

- Tiempo medio de primera respuesta por vendedora.
- Volumen de mensajes enviados/recibidos por día y vendedora.
- SLA: conversaciones respondidas dentro de X horas.
- Conversaciones abiertas/resueltas/pendientes por agente.

**Pasos**:

1. Investigar endpoints Chatwoot a usar:
   - `/api/v2/accounts/1/reports/conversations_with_response_time` — tiempos.
   - `/api/v1/accounts/1/conversations?assignee_type=assigned` — volumen por agente.
   - `/api/v1/accounts/1/reports/agent` — métricas agregadas.
2. Documentar la lista exacta en `.brain/chatwoot_endpoints.md`.
3. Crear job de sync Chatwoot → caché. Nueva tabla `chatwoot_metrics_daily`.
4. Reusar mapeo NocoDB ID ↔ Chatwoot agent ID de `.brain/vendedoras_mapeo.md`.
5. Nueva sección en `PerformanceView` con métricas de **atención** además de **ventas**.
6. Token Chatwoot en vars de entorno — usar el de Yanina (admin).

**Tiempo estimado**: 1 semana.

---

### Fase 4 — Sumar Kapso + reemplazar tendencias simuladas

**Parte A — Kapso (delivery status)**:

- Tasa de entrega WhatsApp (delivered vs failed).
- Tasa de lectura (read receipts).
- Templates rechazados vs aprobados por Meta.

**Parte B — Tendencias reales**:

Con la capa de caché teniendo histórico real, reemplazar `calculateSalesTrend` y `calculateAttemptTrends` por cálculos reales sobre serie temporal.

**Tiempo estimado**: 1 semana.

---

### Fase 5 — Medición y cierre

- Comparar métricas pre-capa vs post-capa (spot check de 20 métricas aleatorias).
- Documentar costo mensual de Supabase.
- Escribir `.brain/runbook_data_layer.md` — cómo mantener la capa.
- Escribir `.brain/schema_cache.md` — diagrama de tablas de la capa.

**Tiempo estimado**: 2-3 días.

---

## Archivos críticos a tocar

| Archivo | Rol | Fase |
|---|---|---|
| `services/metricsCalculator.ts` | Contiene todos los bugs listados | 1 |
| `services/noco.ts` | Capa de acceso NocoDB → evoluciona a `dataSource.ts` | 1, 2 |
| `services/dataService.ts` | Orquestador de fuentes | 2, 3, 4 |
| `api/nocodb/[...table].ts` | Proxy Vercel — fallback o deprecar | 2 |
| `config.ts` | Config de tablas y conexión | 2 |
| `components/PerformanceView.tsx` | Recibe métricas nuevas de Chatwoot | 3 |
| `hooks/useDashboardData.ts` | Hoy consume `cacheService` → evoluciona a `dataSource.ts` | 2 |

## Referencias a reusar (no reinventar)

- `.brain/nocodb_esquema.md` — IDs de tablas, campos, "Estado Actual" mapping.
- `.brain/vendedoras_mapeo.md` — identidad cross-sistema NocoDB ↔ Chatwoot.
- `.brain/contexto_upstream.md` — arquitectura Kapso→n8n→Chatwoot→NocoDB.
- `.brain/relacion_chatwoot_dashboard_app.md` — no confundir con el widget del sidebar.
- `.brain/fuentes_chatwoot_kapso.md` — APIs, MCPs y skills de Chatwoot y Kapso.
- `scripts/validate_metrics.ts` — tests de métricas existentes.
- `scripts/test_noco_tz.ts` — patrón de test para timezone.

## Verificación end-to-end por fase

- **Fase 1**: abrir cada vista, verificar KPIs manualmente, confirmar con Yani. Correr `npm run validate`.
- **Fase 2**: DevTools confirma <1s y <5 requests. Apagar NocoDB y ver que Dashboard sigue.
- **Fase 3**: contar mensajes de María del Carmen hoy en UI Chatwoot vs Dashboard — deben coincidir.
- **Fase 4**: mandar WhatsApp a número inválido → Dashboard lo cuenta como failed.
- **Fase 5**: comparativo completo 20 métricas pre/post.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Divergencia NocoDB ↔ caché durante sync | Timestamp última sync visible en UI. Reconciliación diaria. |
| Costo Supabase crece | Free tier primero. Archivar data > 1 año. |
| NocoDB cambia schema → sync rompe | Schema versioning + alerta al iniciar sync. |
| Token Chatwoot vence | Rotar. Documentar en `.brain/`. |
| Data antigua incorrecta al migrar tendencias | Fase 4 empieza con 1 mes, valida, extiende. |

## Scope explícitamente fuera

- Migración completa de NocoDB.
- Modificar workflow n8n `Registros Leads formularios`.
- Tocar `chatwoot-dashboard-app/`.

## Señal de éxito

- Cada KPI del Dashboard tiene número real y Yani confía.
- Ninguna carga > 1s. Ningún 429 de NocoDB.
- Métricas de SLA Chatwoot visibles.
- Tasa de entrega WhatsApp detecta números malos.
- Una sesión de Claude nueva abre el proyecto y con `.brain/` entiende todo sin preguntar.
