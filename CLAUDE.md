# CLAUDE.md - Contexto del Proyecto Dashboard Yani Coach

## Descripción General
Dashboard de ventas y métricas para Yani Coach. Conecta con NocoDB como backend y muestra KPIs de ventas, pipeline, desempeño de vendedoras y más.

## Stack Tecnológico
- **Frontend**: React 19 + TypeScript + Vite
- **Estilos**: Tailwind CSS v4 + tema personalizado gold
- **Gráficos**: @antv/g2 (importación dinámica)
- **Backend**: NocoDB (API REST)
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
- `noco.ts` - Conexión a NocoDB, normalización de datos
- `metricsCalculator.ts` - Cálculo de KPIs y métricas
- `dataService.ts` - Servicio de datos con fallback a demo

### Hooks (hooks/)
- `useG2Chart.ts` - Hook para gráficos G2 con cleanup automático

### API (api/)
- `nocodb/[...table].ts` - Proxy serverless para NocoDB

## Convenciones de Código

### Estilo
- TypeScript estricto
- Componentes funcionales con hooks
- JSDoc para funciones públicas
- Console.log de debug envueltos en `if (NOCODB_CONFIG.IS_DEV)`

### Gráficos G2
- Usar el hook `useG2Chart` para todos los gráficos
- Importación dinámica de @antv/g2
- Cleanup automático al desmontar

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

## Próximos Pasos (Roadmap)
- [ ] Migrar todos los gráficos a useG2Chart
- [ ] Implementar tooltips de métricas (ver PLAN_TOOLTIPS_METRICAS.md)
- [ ] Mejoras de performance en metricsCalculator.ts
