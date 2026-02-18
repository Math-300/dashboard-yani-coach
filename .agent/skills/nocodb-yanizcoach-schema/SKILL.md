# Skill: NocoDB YanizCoach – Schema Navigator

## Intent

Esta skill enseña al agente a entender el modelo de datos real de la base NocoDB YanizCoach (Contactos, Interacciones, Ventas, Intentos de Compra, Vendedoras, Productos, Etiquetas, etc.) antes de tocar datos.

Se usa cuando:
- El usuario pregunta dónde está guardada cierta información.
- El agente necesita contexto estructural para consultas, reportes o automatizaciones.

## Modelo de datos YanizCoach (alto nivel)

Tablas principales:

- **Contactos**
  - Campos clave: Id, Nombre, Apellido, Email, Teléfono, País, Estado Actual, Desafío, EstimatedValue, Lead_Age_Days, Last_Interaction.
  - Relaciones:
    - `Vendedoras_id` → Vendedoras (quién lo atiende).
    - `Etiquetas_id` + links a Etiquetas (segmentación).
    - Links a Interacciones (historial de contacto).
    - Links a Intentos de Compra (pipeline).
    - Links a Ventas (compras realizadas).

- **Vendedoras**
  - Campos clave: Id, Nombre de la Vendedora, Email, Teléfono, Usuario del Sistema, Estado.
  - Métricas: Total Ventas (Mes Actual), Leads Asignados (Hoy), Leads Asignados (Total) (Rollups).
  - Relaciones:
    - Links a Contactos, Interacciones, Ventas Cerradas, Recueraciones Asignadas.

- **Interacciones**
  - Campos clave: Id, Fecha, Tipo, Resultado, Resumen de la Interacción, Prioridad, Medio/Canal, Origen Específico, Duración.
  - Relaciones:
    - `Vendedoras_id` + “Realizada Por”.
    - `Contactos_id` + “Contacto Involucrado”.
    - Etiquetas Asociadas.
    - Campo `Fecha Próximo Seguimiento`.

- **Ventas**
  - Campos clave: Id, Fecha, Monto Final, Estado del Pago, ID de Transacción, Tipo de Oferta, Interaction_Count_Snapshot, Sales_Cycle_Days.
  - Relaciones:
    - `Vendedoras_id` + “Quién Vendió”.
    - `Productos_id` + “Producto Vendido”.
    - `Intentos de Compra_id` + “Intentos de Compra”.
    - Link a Contact (contacto asociado).

- **Intentos de Compra**
  - Campos clave: Id, Fecha del Intento, Estado, Mensaje de Error.
  - Relaciones:
    - `Vendedoras_id` + “Vendedora de Recuperación”.
    - Link a Venta Realizada.
    - `Contactos_id` + “Quién Intentó Comprar”.

- **Productos**
  - Campos clave: Id, Nombre del Producto, Precio, Categoría, Estado, URL de pago, Imagenes.
  - Relaciones:
    - Links a Ventas Realizadas.
    - Links a Etiquetas.
    - Links/ForeignKey a Contactos (posibles duplicidades Contactos/Contactos1).

- **Etiquetas**
  - Campos clave: Id, Nombre de la Etiqueta, Descripción, Tipo de Etiqueta.
  - Relaciones:
    - Links a Contactos con Etiqueta, Productos, Interacciones.

- **Avatares**
  - Campos clave: Id, Title, fotos.
  - Relación probable con Contactos vía campo Avatar.

- **Procesos y Sistemas Yani Coach**
  - Campos clave: Proceso a seguir, Explicación Paso a paso (URL), Cuando usarlo, Checklist de pasos a seguir (URL).
  - Uso: documentación operativa/procesos que el agente puede seguir.

- **Dashboard_Cache**
  - Campos clave: Title, Metric_Key, Value_Json, Last_Updated.
  - Uso: cache de métricas para dashboards (no modificar sin cuidado).

## Tools relevantes (MCP NocoDB)

- `getBaseInfo`
- `getTablesList`
- `getTableSchema`
- `queryRecords` (solo samples)

## Procedimiento

1. **Confirmar la tabla relevante**
   - Según lo que pida el usuario:
     - Leads/contactos → tabla Contactos.
     - Seguimiento/llamadas → Interacciones.
     - Ventas e ingresos → Ventas.
     - Carrito/intentos fallidos → Intentos de Compra.
     - Equipo → Vendedoras.
   - Si hay duda, pregunta al usuario.

2. **Verificar schema en caliente**
   - Usa `getTableSchema` de la tabla objetivo para confirmar campos y tipos.
   - No asumas estructura si ha podido cambiar.

3. **Detectar relaciones importantes**
   - Identifica FKs y Links entre:
     - Contactos ↔ Interacciones ↔ Intentos de Compra ↔ Ventas ↔ Vendedoras.
     - Contactos/Interacciones/Productos ↔ Etiquetas.
   - Usa nombres de campos (`*_id`, “LinkToAnotherRecord”, “Lookup”, “Rollup”) como guía.

4. **Tomar muestras pequeñas**
   - Si necesitas ver ejemplos reales, usa `queryRecords` con `limit` pequeño (5–20).
   - Oculta datos sensibles salvo que el usuario lo pida.

5. **Explicar el modelo al usuario**
   - Resume cómo fluye un lead:
     - Contactos → Interacciones → Intentos de Compra → Ventas.
   - Indica dónde mirar para:
     - Performance del equipo → Vendedoras.
     - Segmentación → Etiquetas.
     - Cache de metrics → Dashboard_Cache.

## Reglas

- No modificar datos usando esta skill.
- Documentar siempre qué tablas y relaciones se están usando para la tarea.
- Si aparece inconsistencia (ej. múltiples FKs a Contactos), preguntar al usuario qué convención usan.
