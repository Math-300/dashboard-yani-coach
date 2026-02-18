# Skill: NocoDB YanizCoach – Safe CRUD

## Intent

Asegurar que todas las operaciones de creación, actualización y borrado sobre Contactos, Interacciones, Ventas, Intentos de Compra, Vendedoras, etc., se hagan con máxima seguridad y respeto a las reglas de negocio.

Se usa cuando:
- Se piden cambios en datos (crear/editar/borrar).
- Se hacen limpiezas o correcciones masivas.

## Tools MCP NocoDB

- `getTableSchema`
- `queryRecords`
- `createRecords`
- `updateRecords`
- `deleteRecords`
- `countRecords`
- `aggregate`

## Reglas específicas por tabla

- **Contactos**
  - Alta sensibilidad: contiene datos personales (Email, Teléfono, País).
  - No borrar contactos sin confirmación explícita; preferir campos de estado (Estado Actual) para “cerrar” leads.
  - Respetar campos derivados (Lead_Age_Days, Last_Interaction) que probablemente se calculan automáticamente.

- **Vendedoras**
  - No tocar `Contraseña Nocodb`.
  - Cambios en `Estado` impactan asignación y métricas; confirmar siempre.
  - Métricas tipo “Total Ventas (Mes Actual)” y “Leads Asignados” son Rollups: no se escriben directamente.

- **Interacciones**
  - `Fecha`, `Tipo`, `Resultado`, `Resumen de la Interacción` y `Fecha Próximo Seguimiento` son clave para seguimiento.
  - No borrar interacciones a menos que sean claramente test o duplicados.
  - Mantener consistente `Vendedoras_id` y `Contactos_id` para preservar trazabilidad.

- **Ventas**
  - No cambiar `Monto Final`, `Estado del Pago` o `Fecha` sin una razón clara (errores, pruebas).
  - Si hay cambios en estado de pago, revisar impacto en métricas y dashboards.
  - No tocar `Sales_Cycle_Days` si es fórmula.

- **Intentos de Compra**
  - Útiles para recuperar ventas perdidas y analizar fricción.
  - No borrar registros salvo datos de prueba; preferir usar el campo `Estado`.

- **Dashboard_Cache**
  - Solo modificar vía procesos controlados; normalmente escribir aquí forma parte de un job o script, no de cambios manuales.

## Procedimiento general

1. **Clarificar intención**
   - Preguntar:
     - Qué tabla.
     - Qué registros (condición/IDs).
     - Qué campos cambiar.
   - Si es operación masiva, pedir ejemplos.

2. **Ver schema**
   - `getTableSchema` de la tabla objetivo.
   - Identificar campos obligatorios, de solo lectura, fórmulas, rollups, lookups.

3. **Estimar impacto**
   - `countRecords` o `aggregate` con las condiciones objetivo.
   - Informar al usuario: “Se verán afectados X registros”.

4. **Confirmación explícita**
   - Antes de `updateRecords` o `deleteRecords`, pedir un “sí” claro del usuario, describiendo:
     - Tabla.
     - Filtros.
     - Campos a cambiar o borrar.

5. **Ejecutar en lotes y validar**
   - Para cambios grandes, operar en lotes.
   - Tras cada operación:
     - Reconsultar con `countRecords`/`aggregate`.
     - Mostrar sample con `queryRecords`.

## Patrones

- **Corrección de estado de lead**
  - Tabla: Contactos.
  - Cambiar `Estado Actual` con filtro por condiciones claras (ej. leads sin respuesta > X días).
  - Confirmar impacto en métricas/reporte antes.

- **Asignación de leads a vendedoras**
  - Campos: `Vendedoras_id` en Contactos, Intentos de Compra, Interacciones si aplica.
  - Mantener consistencia entre tablas relacionadas.

- **Marcado de ventas erróneas**
  - En Ventas, preferir usar un estado específico en `Estado del Pago` o un campo de flag, en lugar de borrar la venta, salvo pruebas.

## Restricciones

- No tocar campos de contraseñas, IDs, timestamps, formulas, lookups y rollups salvo instrucciones explícitas.
- No ejecutar deletes masivos sin backup u otro mecanismo de recuperación (recomendar automatización en n8n).
- Si la operación parece business-critical, sugerir que primero se pruebe en un grupo reducido de registros.
