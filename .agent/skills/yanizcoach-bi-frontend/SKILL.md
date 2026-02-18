# Skill: YanizCoach BI – NocoDB Frontend Architect

## Intent

Esta skill define **cómo debe trabajar el agente dentro del proyecto BI de YanizCoach**: una SPA en React+TypeScript que consume NocoDB como backend transaccional y calcula métricas en el cliente.

Se usa cuando:
- El usuario pida cambios o features en este dashboard (nuevas métricas, vistas, filtros, gráficos).
- Haya que tocar lógica de datos, servicios NocoDB o componentes de UI relacionados con KPIs.

## Arquitectura que debes respetar

1. **Stack principal**
   - React 19 + Vite.
   - TypeScript estricto (no usar `any` en lógica de negocio).
   - Tailwind CSS con dark mode (`class="dark"` en `<html>`).
   - Recharts v2 para visualizaciones (usar `ResponsiveContainer` para todos los gráficos).

2. **Capa de datos (services/)**
   - Acceso a NocoDB **solo** a través del cliente HTTP dedicado (por ejemplo `noco.ts`), nunca con `fetch` directo dentro de componentes.
   - Paginación automática implementada (loop con `limit` y `offset`) para traer todos los registros.
   - Mapeo heurístico idioma-agnóstico:
     - Siempre intentar leer propiedades tanto en inglés como en español (ej. `item.Name || item.Nombre`).
     - Mantener este patrón al añadir nuevos mappers (Sellers, Contacts, Sales, Interactions, Attempts).
   - Normalización:
     - Fechas normalizadas a `Date` o strings consistentes.
     - Relaciones: extraer IDs desde campos `LinkToAnotherRecord` de NocoDB.
     - Attachments: extraer `signedUrl` para imágenes/archivos.

3. **Orquestador de datos (`dataService.ts` o equivalente)**
   - Actúa como **única puerta de entrada** de datos a la app.
   - Decide si usar:
     - Datos reales (NocoDB) o
     - Datos Mock (`generateMockData`), según variables de entorno (`isApiConfigured`).
   - Dispara **todas las peticiones principales en paralelo** (Sellers, Contacts, Sales, Interactions, Attempts) con `Promise.all` para mejorar la carga inicial.

4. **Motor de métricas (Client-side OLAP)**
   - NocoDB es transaccional; las métricas se calculan **en el cliente**.
   - Lógica principal vive en vistas como `BusinessView`, `TeamView`, `RecoveryView`.
   - Patrones que debes seguir:
     - Cohortes de tiempo según `dateRange` (start/end).
     - KPIs derivados:
       - Tasa de conversión = Ventas en periodo / Leads nuevos en periodo.
       - Ciclo de ventas = `Sale.date - Contact.createdAt` en días.
       - Atribución de canal: usar Interacciones (Email, WhatsApp, Llamada, etc.) de contactos que compraron.
       - Buckets de antigüedad de leads (<7, 7–30, >30 días).

5. **Arquitectura de componentes**
   - `App.tsx`: fuente de verdad de estado global (datos cargados + `dateRange`).
   - `DateRangePicker.tsx`:
     - Trabaja con `Date` nativos.
     - Evita problemas de zona horaria.
     - Incluye presets como “Last Month” calculando primer y último día del mes previo.
   - Vistas:
     - `BusinessView`: revenue, ticket promedio, pipeline ponderado.
     - `TeamView`: leaderboard por performance (orden prioritario por revenue, desempate por número de ventas).
     - `RecoveryView`: cruza Intentos de Compra con Contactos para dinero perdido, motivos de abandono y potencial recuperación.

6. **Seguridad y configuración**
   - Variables sensibles siempre via `import.meta.env` y un `config.ts` central.
   - `config.ts` debe limpiar strings (`.trim()`) para evitar errores por espacios extra en tokens/URLs.
   - Logs de debug:
     - Usar `console.groupCollapsed` sólo detrás de flags o entornos controlados.
     - No exponer info sensible en UI final.

## Qué debes hacer cuando modifiques este proyecto

1. **Antes de tocar código**
   - Identifica si el cambio:
     - Requiere nueva métrica.
     - Requiere nuevo gráfico.
     - Requiere nuevos datos desde NocoDB.
   - Localiza:
     - Interfaces/Types relevantes (Seller, Contact, Sale, Interaction, Attempt).
     - Servicios en `services/` y el orquestador de datos.

2. **Si necesitas nuevas columnas o tablas de NocoDB**
   - Añade soporte en el cliente HTTP/mappers:
     - Respetando paginación automática.
     - Respetando mapeo heurístico bilingüe.
   - Normaliza tipos:
     - Fechas → `Date` o string consistente.
     - Relaciones → IDs claros y, cuando aplique, arrays tipados.

3. **Si necesitas nuevas métricas/KPIs**
   - Implementa la lógica:
     - En el cliente (componentes de vista o hooks específicos), no en servicios de datos.
     - Usando los arrays normalizados y filtrando por `dateRange`.
   - Asegura que:
     - La métrica se pueda derivar sin consultas adicionales innecesarias a NocoDB.
     - El cálculo sea puro (sin efectos secundarios).

4. **Si agregas o modificas gráficos**
   - Usa Recharts v2 con `ResponsiveContainer`.
   - Mantén la separación:
     - Capa de datos → prepara arrays ya agregados/agrupados.
     - Capa de presentación → sólo renderiza.
   - Respeta dark mode y la paleta Tailwind ya definida.

5. **Si cambias la configuración de entorno**
   - Centraliza todo en `config.ts`.
   - Nunca accedas a `import.meta.env` directamente desde muchos archivos; usa siempre la capa de config.
   - Verifica que el modo demo (Mock) siga funcionando cuando la API no esté configurada.

## Cosas que NO debes hacer

- No introducir `any` en types centrales. Mantén el tipado estricto.
- No hacer llamadas directas a `fetch`/Axios a NocoDB desde componentes; solo a través del cliente HTTP existente.
- No mover lógica de métricas al backend sin instrucción explícita (el diseño actual asume OLAP en el cliente).
- No romper el patrón de carga concurrente (`Promise.all`) ni la capacidad de modo demo.
- No exponer tokens, URLs internas ni datos sensibles en logs visibles al usuario.

## Ejemplos de tareas ideales para esta skill

- “Añade un KPI de tasa de recuperación (ventas recuperadas / intentos fallidos) y represéntalo en RecoveryView.”
- “Genera una vista adicional que compare performance de vendedoras por canal (WhatsApp vs Email vs Llamadas).”
- “Refactoriza la capa de mappers para soportar una nueva tabla de NocoDB manteniendo el mapeo bilingüe y paginación automática.”
