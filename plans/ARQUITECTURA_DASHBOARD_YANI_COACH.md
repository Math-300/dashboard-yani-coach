# 🏗️ ARQUITECTURA - Dashboard Yani Coach
## Plan Integral de Mejoras y Correcciones

---

## 📊 Resumen Ejecutivo del Proyecto

**Dashboard de Analytics** para seguimiento de ventas de una coach de alto valor. Conecta con NocoDB para obtener datos de:
- **Contactos** (27,676 registros)
- **Interacciones** (10,524 registros)
- **Ventas** (1 registro - vacío)
- **Intentos de Compra** (1 registro - vacío)
- **Vendedoras** (3 registros)

### Estado Actual
| Área | Severidad | Descripción |
|------|-----------|-------------|
| 📊 Datos NocoDB | 🔴 CRÍTICO | Ventas e Intentos vacíos |
| 🔧 Mapeos Código | 🟠 MEDIO | Estados/interacciones mal mappeados |
| ⚡ Rendimiento | 🟠 MEDIO | Carga 27K+ registros sin paginación server-side |
| 🔒 Seguridad | 🔴 CRÍTICO | Token API expuesto en frontend |

---

## 🎯 Objetivos del Proyecto

1. **Corregir mapeos** para mostrar datos正确os
2. **Mejorar rendimiento** con paginación server-side y filtros
3. **Implementar seguridad** (proxy para token)
4. **Preparar integración de datos** cuando se populen las tablas

---

## 🔴 PRIORIDAD 1: Correcciones Críticas de Datos

### 1.1 Corregir Mapeo de Estados en [`services/noco.ts`](services/noco.ts:148)

**Problema:** 4 estados caen incorrectamente como "Lead Nuevo"

**Estados a corregir:**
| Estado NocoDB | Mapping Actual | Mapping Correcto |
|--------------|----------------|------------------|
| "No se presentó" | NEW | CONTACTED |
| "Leads perdidos (que nunca...)" | NEW | CLOSED_LOST |
| "Nutrición a Largo Plazo" | NEW | CONTACTED |
| "no contactar" | NEW | CLOSED_LOST |

**Acción:** Modificar función `getRealContacts()` líneas 148-153

### 1.2 Corregir Mapeo de Tipos de Interacción

**Problema:** 4 tipos caen como WHATSAPP por defecto

**Tipos a agregar:**
| Tipo NocoDB | Mapping Actual | Mapping Correcto |
|-------------|----------------|------------------|
| "System.io" | WHATSAPP | NEW_CHANNEL |
| "Formulario Web" | WHATSAPP | NEW_CHANNEL |
| "ManyChat" | WHATSAPP | NEW_CHANNEL |
| "Sistema" | WHATSAPP | NEW_CHANNEL |

**Acción:** 
1. Agregar `NEW_CHANNEL` al enum [`InteractionType`](types.ts:2) en `types.ts`
2. Modificar función `getRealInteractions()` líneas 180-184

### 1.3 Corregir Cálculo de Duración

**Problema:** El campo `Duración (Minutos)` es tipo Duration (NocoDB serializa como **segundos**), pero el código multiplica por 60.

**Código actual (línea 192):**
```typescript
durationSeconds: Number(item['Duración (Minutos)']) || 0) * 60
```

**Corrección:**
```typescript
// Duration en NocoDB ya viene en segundos, no multiplicar
durationSeconds: Number(item['Duración (Minutos)']) || 0
```

---

## 🟠 PRIORIDAD 2: Mejoras de Rendimiento

### 2.1 Implementar Filtros Server-Side en NocoDB

**Problema actual:** Se cargan TODOS los registros y se filtran en JavaScript.

**Solución:** Usar parámetro `where` en las queries de NocoDB.

```typescript
// En fetchNoco, agregar filtro de fechas
const whereClause = `(Fecha,ge,${startDate})~and(Fecha,le,${endDate})`;
const url = `${NOCODB_CONFIG.BASE_URL}/api/v2/tables/${tableId}/records?where=${encodeURIComponent(whereClause)}`;
```

### 2.2 Eliminar Límite de Paginación Hardcoded

**Problema:** Línea 114 limita a 10 páginas (10,000 registros).

**Corrección:** Eliminar o hacer configurable el límite.

### 2.3 Optimizar Carga Paralela

**Problema:** `Promise.all()` carga todas las tablas simultáneamente.

**Mejora:** Cargar solo tablas necesarias según la vista activa:
- **Visión General**: Contactos + Interacciones + Ventas
- **Equipo**: Vendedoras + Ventas
- **Recuperación**: Intentos de Compra

---

## 🔒 PRIORIDAD 3: Seguridad

### 3.1 Ocultar Token API (Proxy Server)

**Problema:** `VITE_NOCODB_TOKEN` se expone en el bundle JavaScript.

**Solución a largo plazo:** Crear servidor proxy (API route o serverless function).

**Solución inmediata:** 
1. Usar token de **solo lectura** (Viewer role) en NocoDB
2. Configurar restricciones IP en NocoDB
3. Agregar warning visible en UI cuando se usa token con permisos altos

### 3.2 Eliminar Campo de Contraseña

**Problema:** Campo "Contraseña Nocodb" en tabla Vendedoras almacena contraseñas en texto plano.

**Acción:** Eliminar el campo de NocoDB (usar skill nocodb-basics).

---

## 📋 PRIORIDAD 4: Preparación para Datos Reales

### 4.1 Poblar Tabla Ventas

**Acciones requeridas:**
1. Eliminar registro fantasma ID:3 (todos los campos NULL)
2. Crear registros de ventas reales con:
   - `Fecha`
   - `Monto Final`
   - `Quién Vendió` (link a Vendedoras)
   - `Producto Vendido` (link a Productos)
   - `Contact` (link a Contactos)

### 4.2 Poblar Tabla Intentos de Compra

**Acciones requeridas:**
1. Eliminar registro fantasma ID:1
2. Agregar campo `Monto` (tipo Currency)
3. Crear registros de intentos con:
   - `Fecha del Intento`
   - `Estado`
   - `Quién Intentó Comprar`
   - `Vendedora de Recuperación`
   - `Monto`

---

## 🔧 Tareas Técnicas por Archivo

### [`types.ts`](types.ts) - Modificaciones
- [ ] Agregar `NEW_CHANNEL` al enum `InteractionType`
- [ ] Opcional: Agregar `System` al enum `LeadStatus`

### [`services/noco.ts`](services/noco.ts) - Modificaciones
- [ ] **Línea 148-153**: Corregir mapeo de estados (4 estados adicionales)
- [ ] **Línea 180-184**: Corregir mapeo de tipos de interacción
- [ ] **Línea 192**: Corregir cálculo de duración (quitar *60)
- [ ] **Línea 76**: Agregar filtro de fechas en URL
- [ ] **Línea 114**: Eliminar límite hardcoded de páginas

### [`services/dataService.ts`](services/dataService.ts) - Modificaciones
- [ ] Implementar carga diferida por vista activa
- [ ] Agregar caché en memoria (evitar recargas innecesarias)

### NocoDB - Acciones
- [ ] Eliminar registros fantasma en Ventas e Intentos
- [ ] Agregar campo `Monto` a Intentos de Compra
- [ ] Eliminar campo "Contraseña Nocodb" de Vendedoras

---

## 📦 Estructura de Archivos Post-Reforma

```
src/
├── components/
│   ├── BusinessView.tsx       # KPIs Financieros
│   ├── TeamView.tsx           # Ranking y RRHH
│   ├── RecoveryView.tsx       # Recuperación y Churn
│   ├── KPICard.tsx            # Widget de métrica
│   └── DateRangePicker.tsx    # Selector de fechas
├── services/
│   ├── noco.ts                # API Client + Normalizers
│   └── dataService.ts         # Data Orchestrator + Cache
├── hooks/
│   └── useDashboardData.ts    # Custom hook para datos (nuevo)
├── types.ts                   # Interfaces & Enums
├── config.ts                  # Configuración segura
├── App.tsx                    # Layout Principal
└── index.tsx                  # Entry Point

.env                          # Sin VITE_NOCODB_TOKEN (ya no necesario)
.env.production               # Token en servidor, no en cliente
```

---

## ✅ Definition of Done

### Criterios de Éxito
1. ✅ Mapeo de estados cubre el 100% de estados posibles en NocoDB
2. ✅ Mapeo de interacciones incluye todos los canales
3. ✅ Duración se muestra correctamente (no inflada 60x)
4. ✅ Filtros de fecha se aplican en servidor, no cliente
5. ✅ No hay límite artificial de registros
6. ✅ Token API configurado como solo lectura
7. ✅ Tablas Ventas e Intentos tienen datos reales (o se explica por qué no)

### Verification
- [ ] Console no muestra errores de mapeo
- [ ] Dashboard carga en menos de 5 segundos
- [ ] Métricas de prueba muestran datos coherentes

---

## 📅 Fases de Implementación Sugeridas

| Fase | Descripción | Duración Estimada |
|------|-------------|-------------------|
| **Fase 1** | Correcciones de mapeo (types + noco.ts) | 30 min |
| **Fase 2** | Mejoras de rendimiento (filtros server-side) | 1 hora |
| **Fase 3** | Seguridad (token solo lectura) | 15 min |
| **Fase 4** | Poblar datos en NocoDB | Variable |

---

## ⚠️ Riesgos Identificados

1. **Datos aún vacíos**: Aunque se corrija el código, las tablas Ventas e Intentos están vacías - el dashboard mostrará $0
2. **Cambios en esquema NocoDB**: Si se agregan nuevos estados/interacciones, hay que actualizar mapeos
3. **Performance con datos reales**: Con 27K+ contactos, even con paginación, hay que optimizar renderizado de React

---

## 🔗 Recursos

- [Skill NocoDB Basics](./nocodb-basics/SKILL.md)
- [Skill NocoDB Views](./nocodb-views/SKILL.md)  
- [Skill NocoDB API](./nocodb-api/SKILL.md)
- [Skill NocoDB Automations](./nocodb-automations/SKILL.md)
