# CLAUDE.md - Contexto del Proyecto Dashboard Yani Coach

## Regla #1: Leer `.brain/` antes de trabajar

**Al iniciar cualquier sesión en este proyecto**, leer primero `.brain/INDEX.md`. Ahí está el contexto cross-proyecto (arquitectura Kapso→n8n→Chatwoot→NocoDB, esquema NocoDB, mapeo de vendedoras, diferencia con `chatwoot-dashboard-app`). Este archivo (`CLAUDE.md`) solo cubre el stack técnico del Dashboard en sí.

## Descripción General
Dashboard de ventas y métricas para Yani Coach. Conecta con NocoDB como backend y muestra KPIs de ventas, pipeline, desempeño de vendedoras y más.

Forma parte del ecosistema más amplio **Yani Coach** (proyecto padre en `../`). Este Dashboard **solo lee** de NocoDB — toda la mutación vive en el workflow n8n del proyecto padre. Ver `.brain/contexto_upstream.md` para el diagrama completo.

## Stack Tecnológico
- **Frontend**: React 19 + TypeScript + Vite
- **Router**: react-router-dom 7
- **Estilos**: Tailwind CSS v4 + tema personalizado gold
- **Gráficos**: Recharts 3
- **Iconos**: lucide-react
- **Backend**: NocoDB (API REST, vía proxy serverless)
- **Deployment**: Vercel (serverless functions)

## Estructura del Proyecto

### Componentes de Vistas (components/)
| Componente | Propósito | Tamaño |
|------------|-----------|--------|
| ExecutiveView | Resumen ejecutivo con KPIs principales | ~12KB |
| SalesView | Ventas e ingresos | ~26KB |
| PerformanceView | Desempeño de vendedoras | ~30KB |
| PipelineView | Pipeline y actividad | ~31KB |
| BusinessView | Visión general | ~19KB |
| TeamView | Equipo | ~14KB |
| RecoveryView | Calidad y recuperación | ~21KB |

### Servicios (services/)
- `noco.ts` — Conexión a NocoDB, normalización de datos, micro-fetching, paginación
- `cacheService.ts` — Caché en memoria del cliente + pub/sub para invalidación (propaga errores sin enmascararlos)
- `metricsCalculator.ts` — Cálculo de KPIs y métricas
- `authService.ts` — Cliente de `/api/auth/*`
- `chatService.ts` — Cliente de `/api/chat`

### Hooks (hooks/)
- `useDashboardData.ts` — Carga datos vía `cacheService`, filtra por rango de fechas, expone `funnelCounts` e `interactionCounts` pre-calculados

### API serverless (api/)
- `nocodb/[...table].ts` — Proxy a NocoDB con throttle + caché
- `auth/login.ts`, `auth/logout.ts`, `auth/session.ts` — Autenticación por contraseña maestra
- `chat.ts` — Asistente IA (OpenAI)
- `metrics/summary.ts` — Resumen agregado server-side

## Convenciones de Código

### Estilo
- TypeScript estricto
- Componentes funcionales con hooks
- JSDoc para funciones públicas
- Console.log de debug envueltos en `if (NOCODB_CONFIG.IS_DEV)`

### Gráficos
- Todos los gráficos con Recharts (componentes declarativos: `<LineChart>`, `<BarChart>`, `<PieChart>`, etc.)
- NO usar `@antv/g2` — se migró a Recharts. Si aparece una referencia en docs viejas, ignorarla

### Colores
- Tema gold personalizado: gold-400 (primary), gold-500 (accent)
- Dark mode forzado
- Ver `docs/SOLUCION_COLORES_GOLD.md` para detalles

## Configuración de Entorno

### Desarrollo Local (.env.local)
```
VITE_NOCODB_URL=https://app.nocodb.com
VITE_NOCODB_TOKEN=tu_token_aqui
VITE_TABLE_SELLERS=...
VITE_TABLE_CONTACTS=...
VITE_TABLE_INTERACTIONS=...
VITE_TABLE_SALES=...
VITE_TABLE_ATTEMPTS=...
VITE_LOCAL_AUTH_KEY=clave_local_para_login
```

### Vercel (vercel.env.example)
Variables sin prefijo VITE_ para el serverless.

## Notas Importantes

1. **Fechas**: NocoDB devuelve fechas en UTC, normalizar en `services/noco.ts`
2. **Paginación**: NocoDB tiene límite de 100 registros, usar paginación
3. **Demo Mode**: Si no hay conexión a NocoDB, muestra datos de demostración
4. **Zona horaria**: America/Bogota (UTC-5)
5. **Auth local**: si `VITE_LOCAL_AUTH_KEY` está definido en localhost, el login valida en el frontend sin usar `/api/auth/*`.

## Roadmap activo

Ver `plans/PLAN_ARQUITECTURA_DATA_2026-04-18.md` — roadmap de 5 fases desde arreglar bugs actuales hasta capa de caché Supabase + integración Chatwoot/Kapso.
