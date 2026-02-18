# Skill: NocoDB YanizCoach – Reporting & Analytics

## Intent

Definir cómo usar las tablas de YanizCoach (Contactos, Interacciones, Ventas, Intentos de Compra, Vendedoras, Dashboard_Cache, etc.) para construir KPIs y reportes claros.

Se usa cuando:
- El usuario pide métricas de ventas, leads, performance de vendedoras, funnels o dashboards.

## Tools MCP NocoDB

- `getTableSchema`
- `queryRecords`
- `countRecords`
- `aggregate`
- `getRecord`

## Mapas de reporting

- **Ventas**
  - Tabla: Ventas.
  - Campos métricos: `Monto Final`, `Sales_Cycle_Days`.
  - Campos de segmentación: `Fecha`, `Estado del Pago`, `Tipo de Oferta`, `Vendedoras_id`, `Productos_id`.
  - Uso:
    - Ventas por periodo (sum Monto Final, count).
    - Ventas por vendedora.
    - Ventas por producto/oferta.
    - Ciclo de venta promedio.

- **Funnel de leads**
  - Tabla: Contactos.
  - Campo clave: `Estado Actual`.
  - Uso:
    - Conteos por estado (ej. nuevo, en seguimiento, ganado, perdido).
    - Análisis de motivos de pérdida: `Motivo Venta Perdida`.
    - Enriquecido con `Lead_Age_Days` y `Last_Interaction`.

- **Actividad de Interacciones**
  - Tabla: Interacciones.
  - Campos: `Fecha`, `Tipo`, `Resultado`, `Medio/Canal`, `Prioridad`.
  - Uso:
    - Volumen de interacciones por día/semana/mes.
    - Distribución por tipo de interacción y canal.
    - Performance por vendedora (cruce con `Vendedoras_id`).

- **Intentos de Compra y recuperación**
  - Tabla: Intentos de Compra.
  - Campos: `Estado`, `Mensaje de Error`, `Fecha del Intento`.
  - Uso:
    - Número de intentos fallidos vs concretados.
    - Motivos de fallo más frecuentes.
    - Seguimiento por vendedora de recuperación.

- **Performance de Vendedoras**
  - Tabla: Vendedoras.
  - Métricas existentes:
    - Total Ventas (Mes Actual).
    - Leads Asignados (Hoy).
    - Leads Asignados (Total).
  - Se puede cruzar con Ventas e Interacciones para métricas más finas.

- **Dashboard_Cache**
  - Tabla: Dashboard_Cache.
  - Campos: `Metric_Key`, `Value_Json`, `Last_Updated`.
  - Uso:
    - Leer métricas precalculadas para dashboards.
    - No recalcular si ya existe `Metric_Key` relevante y `Last_Updated` es reciente.

## Procedimiento de reporting

1. **Entender la pregunta**
   - Identificar:
     - Tabla(s) relevantes.
     - Periodo.
     - Segmentación (por vendedora, producto, estado, canal).
     - Métrica(s) exactas.

2. **Diseñar la consulta**
   - Para conteos simples:
     - `countRecords` con filtros.
   - Para métricas agregadas:
     - `aggregate` con:
       - Función: sum, avg, min, max.
       - Campo métrico (ej. Monto Final, Sales_Cycle_Days).
       - Campo de agrupación (Fecha, vendedora, producto, estado).

3. **Aplicar filtros explícitos**
   - Siempre indicar:
     - Rango de fechas usado.
     - Estados incluidos.
     - Segmentos (vendedora, producto, origen).

4. **Presentar resultados**
   - Devolver tablas claras:
     - Ej. columnas: periodo, métrica, segmento.
   - Explicar qué significa cada métrica y cómo se calculó.

5. **Optimización**
   - Evitar traer muchos registros con `queryRecords` si `aggregate` puede hacer el cálculo.
   - Usar `Dashboard_Cache` cuando ya exista una métrica precalculada con un `Metric_Key` obvio.

## Buenas prácticas

- No modificar datos desde esta skill.
- No mostrar datos sensibles de contactos salvo que el usuario lo pida.
- Documentar supuestos y filtros en lenguaje natural.
- Cuando un reporte sea recurrente (ej. “ventas por vendedora semanal”), sugerir convertirlo en workflow o job y usar esta skill como especificación.
