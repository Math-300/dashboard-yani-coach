# 🔍 AUDITORÍA COMPLETA — Dashboard Yani Coach
### Fecha: 11 de Febrero de 2026
### Autor: Antigravity AI

---

## 📋 Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Estado de la Base de Datos NocoDB](#2-estado-de-la-base-de-datos-nocodb)
3. [Análisis del Código Frontend](#3-análisis-del-código-frontend)
4. [Problemas Críticos Encontrados](#4-problemas-críticos-encontrados)
5. [Problemas de Rendimiento](#5-problemas-de-rendimiento)
6. [Problemas de Seguridad](#6-problemas-de-seguridad)
7. [Desalineación Código vs NocoDB](#7-desalineación-código-vs-nocodb)
8. [Tablas No Utilizadas por el Dashboard](#8-tablas-no-utilizadas-por-el-dashboard)
9. [Plan de Corrección Paso a Paso](#9-plan-de-corrección-paso-a-paso)
10. [Recomendaciones de Mejora a Futuro](#10-recomendaciones-de-mejora-a-futuro)

---

## 1. Resumen Ejecutivo

| Área | Estado | Severidad |
|------|--------|-----------|
| Conexión NocoDB → Dashboard | ⚠️ Funcional con problemas | Media |
| Tabla Ventas | 🔴 CRÍTICO — Solo 1 registro y campos vacíos | Alta |
| Tabla Intentos de Compra | 🔴 CRÍTICO — Solo 1 registro y campos vacíos | Alta |
| Tabla Vendedoras | ✅ OK — 3 registros con datos completos | Baja |
| Tabla Contactos | ✅ OK — 27,676 registros | Baja |
| Tabla Interacciones | ✅ OK — 10,524 registros | Baja |
| Mappers (noco.ts) | ⚠️ Desalineados con esquema real | Media |
| Seguridad (Token API expuesto) | 🔴 CRÍTICO | Alta |
| Rendimiento (27K+ registros cargados) | 🔴 CRÍTICO | Alta |
| Tablas sin usar | ℹ️ 5 tablas sin conexión al dashboard | Informativa |

### Veredicto General
El dashboard tiene una **arquitectura sólida** pero sufre de **problemas críticos de datos** (Ventas e Intentos prácticamente vacíos), **problemas severos de rendimiento** (carga de 27K+ contactos sin paginación), y una **vulnerabilidad de seguridad** por el API token expuesto en el frontend. Los mappers de datos tienen desalineaciones con los nombres reales de campos en NocoDB que pueden causar datos vacíos o incorrectos en la UI.

---

## 2. Estado de la Base de Datos NocoDB

### Base de datos: "Sales Operations Hub for High-Value Coach"
- **ID**: `pvou30zpih14j9q`
- **Workspace**: `wrr2pita`
- **Creada**: 30 de Septiembre de 2025
- **Última actualización**: 19 de Noviembre de 2025

### 2.1 Inventario de Tablas

| # | Tabla | ID | Registros | Estado | Usada en Dashboard |
|---|-------|----|-----------|--------|--------------------|
| 1 | **Contactos** | `mrwhtwissgz1xzr` | 27,676 | ✅ Saludable | ✅ Sí |
| 2 | **Interacciones** | `m6gx25reozjbbt3` | 10,524 | ✅ Saludable | ✅ Sí |
| 3 | **Ventas** | `mm9p02mlk0i5ysy` | 1 | 🔴 Vacía (datos NULL) | ✅ Sí |
| 4 | **Intentos de Compra** | `mqdlglkwjvvtplc` | 1 | 🔴 Vacía (datos NULL) | ✅ Sí |
| 5 | **Vendedoras** | `me6kwgo0qvg0aug` | 3 | ✅ OK | ✅ Sí |
| 6 | **Productos** | `mjp2xur1esaukgj` | ? | ⚠️ No verificada | ❌ No directamente |
| 7 | **Etiquetas** | `mvz4nme3cthjgig` | ? | ⚠️ No verificada | ❌ No |
| 8 | **Avatares** | `mggfwow5iab1ml8` | ? | ℹ️ Auxiliar | ❌ No |
| 9 | **Procesos y Sistemas** | `mpbym16lmfqdgdz` | ? | ℹ️ Auxiliar | ❌ No |
| 10 | **Dashboard_Cache** | `mwimgj2xmqp9614` | ? | ℹ️ Para caching | ❌ No |

### 2.2 Detalle de la Tabla: Contactos (27,676 registros) ✅

**Campos principales:**
| Campo | Tipo | Usado en noco.ts | Estado |
|-------|------|-------------------|--------|
| `Id` | ID | ✅ `item.Id` | OK |
| `Nombre` | SingleLineText | ✅ `item.Nombre` | OK |
| `Apellido` | SingleLineText | ❌ No mapeado | ⚠️ No se usa |
| `Email` | Email | ❌ No mapeado | ℹ️ Disponible |
| `Teléfono` | PhoneNumber | ❌ No mapeado | ℹ️ Disponible |
| `País` | SingleLineText | ✅ `item['País']` | OK |
| `Estado Actual` | SingleSelect | ✅ `item['Estado Actual']` | ⚠️ Mapping incompleto |
| `Motivo Venta Perdida` | SingleSelect | ✅ `item['Motivo Venta Perdida']` | ⚠️ Mapping incompleto |
| `Vendedora Asignada` | LinkToAnotherRecord | ✅ `item['Vendedora Asignada']` | OK |
| `Fecha y hora de creación` | CreatedTime | ✅ `item['Fecha y hora de creación']` | OK |
| `Desafío` | SingleSelect | ❌ No mapeado | ℹ️ Disponible |
| `EstimatedValue` | Currency (USD) | ❌ No mapeado | ℹ️ Podría ser útil |
| `Próximo Contacto` | DateTime | ❌ No mapeado | ℹ️ Disponible |

**Estados reales en NocoDB vs Mapping del código:**
| Estado en NocoDB | Mapeo en noco.ts | ¿Correcto? |
|------------------|------------------|------------|
| "Lead Nuevo" | `LeadStatus.NEW` (busca "nuevo") | ✅ |
| "Venta Ganada" | `LeadStatus.CLOSED_WON` (busca "ganada") | ✅ |
| "Venta Perdida" | `LeadStatus.CLOSED_LOST` (busca "perdida") | ✅ |
| "Llamada Agendada" | `LeadStatus.INTERESTED` (busca "agendada") | ⚠️ Discutible |
| "En Seguimiento 24 hs..." | `LeadStatus.CONTACTED` (busca "seguimiento") | ✅ |
| "No se presentó" | ❌ NO MAPEADO → Cae en `NEW` por defecto | 🔴 Error |
| "Seguimiento Cliente Nuevo" | `LeadStatus.CONTACTED` (busca "seguimiento") | ✅ |
| "Seguimiento venta perdida" | `LeadStatus.CONTACTED` (busca "seguimiento") | ⚠️ Debería ser CLOSED_LOST |
| "Seguimiento leads sin respuesta" | `LeadStatus.CONTACTED` (busca "seguimiento") | ⚠️ Discutible |
| "Leads perdidos (que nunca...)" | ❌ NO MAPEADO → Cae en `NEW` por defecto | 🔴 Error |
| "Contactar en 48 horas" | `LeadStatus.CONTACTED` (busca "contactar") | ✅ |
| "Nutrición a Largo Plazo" | ❌ NO MAPEADO → Cae en `NEW` por defecto | 🔴 Error |
| "Seguimiento Potencial venta" | `LeadStatus.CONTACTED` (busca "seguimiento") | ⚠️ Debería ser INTERESTED |
| "En Seguimiento 7 días" | `LeadStatus.CONTACTED` (busca "seguimiento") | ✅ |
| "no contactar" | ❌ NO MAPEADO → Cae en `NEW` por defecto | 🔴 Error |

**Resultado:** Hay **4 estados que caen como "Lead Nuevo" incorrectamente**, lo que distorsiona las métricas del dashboard.

### 2.3 Detalle de la Tabla: Interacciones (10,524 registros) ✅

**Campos principales:**
| Campo | Tipo | Usado en noco.ts | Estado |
|-------|------|-------------------|--------|
| `Id` | ID | ✅ | OK |
| `Fecha` | DateTime | ✅ `item.Fecha` | OK |
| `Tipo` | SingleSelect | ❌ No se usa para mapping de tipo | ⚠️ |
| `Medio/Canal` | SingleSelect | ✅ `item['Medio/Canal']` | OK para tipo |
| `Resultado` | SingleSelect | ✅ `item.Resultado` | ⚠️ Es SingleSelect, no string |
| `Resumen de la Interacción` | LongText | ❌ No mapeado | ℹ️ |
| `Realizada Por` | LinkToAnotherRecord | ✅ `item['Realizada Por']` | OK |
| `Contacto Involucrado` | LinkToAnotherRecord | ✅ `item['Contacto Involucrado']` | OK |
| `Duración (Minutos)` | Duration (h:mm:ss) | ✅ `item['Duración (Minutos)']` | ⚠️ Tipo incorrecto |
| `Prioridad` | SingleSelect | ❌ No mapeado | ℹ️ |
| `Date` | DateTime | ⚠️ Campo duplicado | 🔴 Confuso |

**Problemas detectados:**
1. **`Duración (Minutos)`** es tipo `Duration` con formato `h:mm:ss`, NO un número. El código actual hace `Number(item['Duración (Minutos)']) * 60`, lo cual puede devolver `NaN` ya que `Duration` se serializa como segundos enteros, no minutos.
2. **Campo `Date`** duplicado (hay `Fecha` y `Date`). Potencial confusión.
3. **`Resultado`** es un SingleSelect, no texto libre. El mapper lo trata como string, lo cual funciona pero no es óptimo.

**Valores reales de `Medio/Canal` vs Mapping:**
| Medio/Canal en NocoDB | Mapeo en noco.ts | ¿Correcto? |
|-----------------------|------------------|------------|
| "WhatsApp" | `InteractionType.WHATSAPP` | ✅ |
| "Llamada" | `InteractionType.CALL` (busca "llamada") | ✅ |
| "Email" | `InteractionType.EMAIL` (busca "email") | ✅ |
| "System.io" | ❌ Cae en `WHATSAPP` por defecto | 🔴 Error |
| "Formulario Web" | ❌ Cae en `WHATSAPP` por defecto | 🔴 Error |
| "ManyChat" | ❌ Cae en `WHATSAPP` por defecto | 🔴 Error |
| "Sistema" | ❌ Cae en `WHATSAPP` por defecto | 🔴 Error |

**Resultado:** Las interacciones vía System.io, Formulario Web, ManyChat y Sistema se cuentan como WhatsApp, distorsionando métricas.

### 2.4 Detalle de la Tabla: Ventas (1 registro) 🔴 CRÍTICO

**Datos del único registro existente:**
```json
{
  "id": 3,
  "fields": {
    "Fecha": null,
    "Monto Final": null,
    "Estado del Pago": null,
    "Quién Vendió": null,
    "Producto Vendido": null,
    "Contact": []
  }
}
```

**Diagnóstico:** La tabla tiene 1 registro con **TODOS los campos NULL**. Este es un registro fantasma/huérfano. **No hay datos reales de ventas en el sistema.**

**Campos del esquema:**
| Campo | Tipo | Usado en noco.ts | Problema |
|-------|------|-------------------|----------|
| `Fecha` | Date | ✅ | Sin datos |
| `Monto Final` | Currency | ✅ `item['Monto Final']` | Sin datos |
| `Quién Vendió` | LinkToAnotherRecord→Vendedoras | ✅ `item['Quién Vendió']` | Sin datos |
| `Producto Vendido` | LinkToAnotherRecord→Productos | ✅ `item['Producto Vendido']` | Sin datos |
| `Contact` | LinkToAnotherRecord→Contactos | ✅ `item.Contact` | Sin datos |
| `ID de Transacción` | SingleLineText | ❌ No mapeado | Display field |
| `Estado del Pago` | SingleSelect | ❌ No mapeado | Importante |
| `Descuento Aplicado` | SingleLineText | ❌ No mapeado | ℹ️ |
| `Tipo de Oferta` | SingleSelect | ❌ No mapeado | ℹ️ |

**IMPACTO:** El tab "Visión General" del dashboard mostrará $0 en ventas, 0% conversión, y el tab "Equipo" no podrá mostrar ventas por vendedora.

### 2.5 Detalle de la Tabla: Intentos de Compra (1 registro) 🔴 CRÍTICO

**Datos del único registro existente:**
```json
{
  "id": 1,
  "fields": {
    "Fecha del Intento": null,
    "Estado": null,
    "Vendedora de Recuperación": null,
    "Quién Intentó Comprar": null
  }
}
```

**Diagnóstico:** Similar a Ventas. 1 registro fantasma con **todos los campos NULL**.

**IMPACTO:** El tab "Calidad & Recuperación" del dashboard está completamente inoperativo.

**Nota:** La tabla no tiene campo `Monto`, que es requerido por el código. El código usa fallback `5000`:
```typescript
amount: parseAmount(item.Monto || item.Amount || 5000)
```
Este campo **no existe en el esquema real**. Siempre caerá en el fallback de 5000.

### 2.6 Detalle de la Tabla: Vendedoras (3 registros) ✅

| ID | Nombre | Email | Estado | Foto |
|----|--------|-------|--------|------|
| 1 | Ana María Leon | contacto@yaninacoach.com | **Inactivo** | ✅ Tiene |
| 2 | María del Carmen Vera | Yanicoach@yaninacoach.com | Activo | ✅ Tiene |
| 3 | María Beatriz Juzviachik | equipo@yaninacoach.com | Activo | ✅ Tiene |

**Problemas:**
1. El mapper busca `item.Foto || item.Avatar || item.Imagen`. El campo real es **`Foto`**, así que funciona.
2. El campo `Estado` no se usa en el dashboard — vendedoras inactivas siguen apareciendo.
3. Hay un campo sensible **`Contraseña Nocodb`** (SingleLineText plano, sin encriptar). Esto es una vulnerabilidad.

---

## 3. Análisis del Código Frontend

### 3.1 Estructura del Proyecto

```
Dashboard Yani Coach/
├── index.html         ← HTML base con Tailwind CDN + importmap
├── App.tsx            ← Componente raíz, tabs y layout
├── config.ts          ← Configuración de NocoDB desde env vars
├── types.ts           ← Tipos TypeScript (Enums, Interfaces)
├── index.tsx          ← Entry point de React
├── services/
│   ├── noco.ts        ← Mappers de NocoDB → tipos TypeScript
│   └── dataService.ts ← Orquestador (mock vs real)
├── components/
│   ├── BusinessView.tsx   ← Tab "Visión General"
│   ├── TeamView.tsx       ← Tab "Equipo"
│   ├── RecoveryView.tsx   ← Tab "Calidad & Recuperación"
│   ├── DateRangePicker.tsx← Selector de fechas
│   └── KPICard.tsx        ← Tarjeta de KPI reutilizable
├── .env               ← Variables de entorno (⚠️ contiene token)
└── package.json       ← Dependencias
```

### 3.2 Tecnologías

| Tecnología | Versión | Nota |
|-----------|---------|------|
| React | 19.2.3 | ✅ Última estable |
| Vite | 6.2.0 | ✅ Build tool |
| TypeScript | 5.8.2 | ✅ |
| Recharts | 3.7.0 | ✅ Para gráficos |
| Lucide React | 0.562.0 | ✅ Iconos |
| Tailwind CSS | CDN | ⚠️ Se carga por CDN, no optimizado para producción |

### 3.3 Flujo de Datos

```
.env → config.ts → noco.ts → dataService.ts → App.tsx → Components
       (env vars)   (API)    (mock/real)     (state)    (render)
```

---

## 4. Problemas Críticos Encontrados

### 🔴 C1: Tabla Ventas prácticamente vacía

**Impacto:** Dashboard muestra $0 en ventas, 0% conversión.
**Causa raíz:** Las ventas no se están registrando en NocoDB.
**Solución:** Ver [Paso 1 del Plan de Corrección](#paso-1-poblar-tabla-de-ventas).

### 🔴 C2: Tabla Intentos de Compra vacía

**Impacto:** Tab de Recuperación inoperativo.
**Causa raíz:** Los intentos no se registran automáticamente ni manualmente.
**Solución:** Ver [Paso 2 del Plan de Corrección](#paso-2-configurar-intentos-de-compra).

### 🔴 C3: Campo `Monto` no existe en Intentos de Compra

**En el código:**
```typescript
amount: parseAmount(item.Monto || item.Amount || 5000)
```
**En NocoDB:** La tabla NO tiene campo `Monto`. Siempre devuelve 5000 como fallback.
**Solución:** Crear el campo o remover la funcionalidad.

### 🔴 C4: Mapeo de estados incorrecto (4 estados caen en NEW)

Los estados "No se presentó", "Leads perdidos", "Nutrición a Largo Plazo", y "no contactar" se mapean como "Lead Nuevo", inflando artificialmente la métrica de leads nuevos.

### 🔴 C5: Carga de 27,676 contactos sin paginación del lado del servidor

El código tiene paginación interna (`fetchNoco`) pero carga TODOS los registros al estado de React. Con 27K+ contactos, esto significa ~5-15MB de datos en memoria que además se filtran en el cliente.

### 🔴 C6: Token API expuesto en el frontend

El archivo `.env` contiene el token en variable `VITE_`:
```
VITE_NOCODB_TOKEN=6CsjyiTJxEFphpLU1QRDwrxpjo0t3R3ClMCQdvQb
```
Las variables `VITE_` se **inyectan en el JavaScript público** y cualquier usuario puede verlo en DevTools.

---

## 5. Problemas de Rendimiento

### 🟠 P1: Todas las tablas se cargan simultáneamente

```typescript
const [realSellers, realContacts, realInteractions, realSales, realAttempts] = 
  await Promise.all([...]);
```

Con 27K contactos + 10K interacciones = ~37K registros cargados en cada cambio de fecha, aunque el filtro de fechas descartará la mayoría.

**Solución ideal:** Usar filtros `where` en las queries de NocoDB para traer solo datos del rango de fechas.

### 🟠 P2: Paginación limitada a 10 páginas (hardcoded)

```typescript
if (page > 10) break; // hardcoded limit
```

Con `limit=1000` y máximo 10 páginas = máximo 10,000 registros. Contactos tiene 27,676, por lo que **~17,676 contactos nunca se cargan**.

### 🟠 P3: Filtrado de fechas en el cliente

```typescript
interactions: realInteractions.filter(i => isWithinRange(i.date)),
sales: realSales.filter(s => isWithinRange(s.date)),
```

Se cargan todos los datos y se filtran en JavaScript. Debería filtrarse en el servidor.

### 🟠 P4: Tailwind CSS vía CDN

Se usa `<script src="https://cdn.tailwindcss.com">` en vez de procesarlo con PostCSS. En producción esto:
- Aumenta el tiempo de carga inicial
- Procesa CSS en el navegador (lento)
- No genera CSS tree-shaken

---

## 6. Problemas de Seguridad

### 🔴 S1: Token API como variable VITE_ (público)

**Problema:** `VITE_NOCODB_TOKEN` se expone en el bundle de JavaScript.
**Riesgo:** Cualquier persona puede copiar el token y leer/modificar datos.
**Mitigación actual:** El token debería ser de solo lectura (Viewer).
**Solución ideal:** Crear un backend/proxy (API route o serverless function) que contenga el token del lado servidor.

### 🔴 S2: Campo "Contraseña Nocodb" en tabla Vendedoras

El campo `c4d92yyymqpcmgq` (título: "Contraseña Nocodb") almacena contraseñas como texto plano en un campo `SingleLineText`. Si el token tiene permisos amplios, estas contraseñas quedan expuestas.

### 🟠 S3: Sin CORS ni rate limiting

Las llamadas se hacen directamente desde el frontend a `app.nocodb.com`. No hay proxy ni rate limiting del lado de la aplicación.

---

## 7. Desalineación Código vs NocoDB

### 7.1 Tabla Ventas — noco.ts vs esquema real

| Campo en Código | Campo Real en NocoDB | ¿Match? |
|-----------------|---------------------|---------|
| `item.Contact \|\| item.Lead` | `Contact` (Link) | ✅ Parcial (`Contact` match) |
| `item['Quién Vendió']` | `Quién Vendió` (Link) | ✅ |
| `item['Producto Vendido']` | `Producto Vendido` (Link) | ⚠️ `extractId()` devuelve el ID del link, no el nombre |
| `item['Monto Final']` | `Monto Final` (Currency) | ✅ |
| `item.Fecha` | `Fecha` (Date) | ✅ |

**Problema con Producto:** `extractId(item['Producto Vendido'])` devuelve el ID numérico del producto vinculado. Luego se usa como `productName`, mostrando "1" o "2" en vez del nombre del producto.

### 7.2 Tabla Interacciones — Tipos de interacción

El código usa `Medio/Canal` para determinar el tipo, pero hay 7 valores posibles y solo 3 están mapeados:
- ✅ WhatsApp, Llamada, Email
- ❌ System.io, Formulario Web, ManyChat, Sistema → todos caen en `WHATSAPP`

**Recomendación:** Agregar tipo `OTHER` o `SYSTEM` al enum `InteractionType`.

### 7.3 Tabla Interacciones — Duración

El campo `Duración (Minutos)` es tipo `Duration` (formato `h:mm:ss`), que NocoDB serializa como **segundos totales** (número entero). El código hace:
```typescript
durationSeconds: Number(item['Duración (Minutos)']) * 60
```
Si el valor ya es en segundos, multiplicar por 60 **infla la duración 60x**. Una llamada de 5 minutos (300 seg) se mostraría como 18,000 seg (5 horas).

---

## 8. Tablas No Utilizadas por el Dashboard

### 8.1 Productos (`mjp2xur1esaukgj`)

**Campos:** Nombre del Producto, Precio, Categoría, Estado, Imagenes, URL
**Relación:** Vinculada a Ventas y Contactos
**Potencial:** Mostrar qué productos se venden más, precio promedio, catálogo.

### 8.2 Etiquetas (`mvz4nme3cthjgig`)

**Campos:** Nombre de la Etiqueta, Descripción, Tipo de Etiqueta
**Tipos:** Lead Magnet/Funnel, Estado Interno, Acción de Venta
**Relación:** Many-to-many con Contactos
**Potencial:** Segmentación de leads por fuente de captación.

### 8.3 Avatares (`mggfwow5iab1ml8`)

**Campos:** Title, fotos
**Propósito:** Probablemente un catálogo de imágenes para usar en la plataforma.

### 8.4 Procesos y Sistemas (`mpbym16lmfqdgdz`)

**Campos:** Proceso a seguir, Explicación Paso a paso (URL), Cuando usarlo, Checklist (URL)
**Propósito:** Documentación interna del equipo de ventas.

### 8.5 Dashboard_Cache (`mwimgj2xmqp9614`)

**Campos:** Title, Metric_Key, Value_Json, Last_Updated
**Propósito:** Almacenar métricas pre-calculadas. **No se usa actualmente en el código.**
**Potencial:** Podría usarse para cachear métricas y evitar cargar 37K+ registros cada vez.

---

## 9. Plan de Corrección Paso a Paso

### Paso 1: Poblar Tabla de Ventas 🔴 URGENTE

**¿Dónde?** NocoDB → Tabla `Ventas`

1. **Eliminar el registro fantasma** (ID: 3) que tiene todos los campos NULL:
   - En NocoDB web, abrir la tabla Ventas
   - Seleccionar el registro y eliminarlo

2. **Crear registros de ventas reales.** Cada venta debe tener:
   - `Fecha`: La fecha de la venta
   - `Monto Final`: Valor en USD (es campo Currency)
   - `Quién Vendió`: Seleccionar la vendedora (link a Vendedoras)
   - `Producto Vendido`: Seleccionar el producto (link a Productos)
   - `Estado del Pago`: Seleccionar "Pagado", "Pendiente", etc.
   - `Contact`: Vincular al contacto que compró

3. **Opcional pero recomendado:** Configurar n8n o System.io para crear registros en Ventas automáticamente cuando se procese un pago.

---

### Paso 2: Configurar Intentos de Compra 🔴 URGENTE

**¿Dónde?** NocoDB → Tabla `Intentos de Compra`

1. **Eliminar el registro fantasma** (ID: 1)

2. **Agregar campo `Monto`** a la tabla (tipo: Currency, USD):
   - En NocoDB, hacer clic en `+` para agregar columna
   - Nombre: `Monto`
   - Tipo: Currency
   - Moneda: USD

3. **Poblar con datos** cuando haya intentos de compra fallidos. Cada registro necesita:
   - `Fecha del Intento`: DateTime del intento
   - `Estado`: Seleccionar entre "Pendiente de Contacto", "En Seguimiento", "Recuperado", etc.
   - `Quién Intentó Comprar`: Link al contacto
   - `Vendedora de Recuperación`: Link a la vendedora asignada para recuperar
   - `Monto`: Valor del intento (nuevo campo)

---

### Paso 3: Corregir Mapeo de Estados en noco.ts ⚠️ IMPORTANTE

**¿Dónde?** Archivo `services/noco.ts`, función `getRealContacts()`

**Agregar estos mapeos al bloque de estados (líneas 148-153):**

```typescript
// Estados existentes + Nuevos mapeos
const s = rawStatus.toLowerCase();
if (s.includes('nuevo') || s.includes('lead nuevo')) status = LeadStatus.NEW;
else if (s.includes('ganada') || s.includes('venta ganada')) status = LeadStatus.CLOSED_WON;
else if (s.includes('perdida') || s.includes('venta perdida') || s.includes('leads perdidos') || s.includes('no contactar')) status = LeadStatus.CLOSED_LOST;
else if (s.includes('agendada') || s.includes('potencial venta')) status = LeadStatus.INTERESTED;
else if (s.includes('seguimiento') || s.includes('contactar') || s.includes('nutrición')) status = LeadStatus.CONTACTED;
else if (s.includes('no se presentó')) status = LeadStatus.CONTACTED; // O crear nuevo estado
// Fallback para estados no reconocidos
else status = LeadStatus.NEW;
```

**Explicación de cambios:**
- `"No se presentó"` → `CONTACTED` (ya fue contactado pero no se presentó)
- `"Leads perdidos (nunca contestaron)"` → `CLOSED_LOST` (no contactar)
- `"Nutrición a Largo Plazo"` → `CONTACTED` (sigue en pipeline)
- `"no contactar"` → `CLOSED_LOST` (está cerrado)
- `"Seguimiento Potencial venta"` → `INTERESTED` (más que contactado)

---

### Paso 4: Corregir Tipos de Interacción en noco.ts ⚠️ IMPORTANTE

**¿Dónde?** Archivo `types.ts` y `services/noco.ts`

**En `types.ts`, agregar nuevos tipos al enum:**
```typescript
export enum InteractionType {
  CALL = 'Llamada',
  WHATSAPP = 'WhatsApp',
  EMAIL = 'Email',
  SYSTEM = 'Sistema',      // Nuevo
  FORM = 'Formulario',     // Nuevo
  OTHER = 'Otro'           // Nuevo
}
```

**En `noco.ts`, actualizar el mapping de interacciones (líneas 180-184):**
```typescript
const rawType = item['Medio/Canal'] || item.Type || item.Tipo || '';
let type = InteractionType.OTHER;
const lowerType = rawType.toLowerCase();
if (lowerType.includes('whatsapp') || lowerType.includes('manychat')) type = InteractionType.WHATSAPP;
else if (lowerType.includes('llamada') || lowerType.includes('call')) type = InteractionType.CALL;
else if (lowerType.includes('email') || lowerType.includes('correo')) type = InteractionType.EMAIL;
else if (lowerType.includes('system') || lowerType.includes('sistema')) type = InteractionType.SYSTEM;
else if (lowerType.includes('formulario') || lowerType.includes('form')) type = InteractionType.FORM;
```

---

### Paso 5: Corregir Duración de Interacción ⚠️ IMPORTANTE

**¿Dónde?** Archivo `services/noco.ts`, función `getRealInteractions()`

**Problema:** El campo `Duration` de NocoDB ya devuelve segundos, no minutos.

**Cambiar línea 192 de:**
```typescript
durationSeconds: Number(item['Duración (Minutos)'] || item.Duration || 0) * 60,
```
**A:**
```typescript
durationSeconds: Number(item['Duración (Minutos)'] || item.Duration || 0),
```

Eliminar la multiplicación `* 60` ya que el valor ya viene en segundos.

---

### Paso 6: Corregir el nombre de producto en Ventas ⚠️ IMPORTANTE

**¿Dónde?** Archivo `services/noco.ts`, función `getRealSales()`

**Problema:** `extractId(item['Producto Vendido'])` devuelve el ID numérico, no el nombre.

**Cambiar línea 206 de:**
```typescript
productName: extractId(item['Producto Vendido']) || item.Product || 'Servicio General',
```
**A:**
```typescript
productName: (() => {
  const prod = item['Producto Vendido'];
  if (prod && typeof prod === 'object') {
    return prod.fields?.['Nombre del Producto'] || prod['Nombre del Producto'] || 'Servicio General';
  }
  if (Array.isArray(prod) && prod.length > 0) {
    return prod[0].fields?.['Nombre del Producto'] || prod[0]['Nombre del Producto'] || 'Servicio General';
  }
  return item.Product || 'Servicio General';
})(),
```

---

### Paso 7: Aumentar límite de paginación ⚠️ IMPORTANTE

**¿Dónde?** Archivo `services/noco.ts`, función `fetchNoco()`

**Cambiar línea 114 de:**
```typescript
if (page > 10) break;
```
**A:**
```typescript
if (page > 50) break; // Permitir hasta 50,000 registros
```

**O mejor aún**, implementar filtrado del lado servidor (ver Paso 9).

---

### Paso 8: Filtrar Vendedoras Inactivas ℹ️ MEJORA

**¿Dónde?** Archivo `services/noco.ts`, función `getRealSellers()`

Agregar filtro para excluir vendedoras inactivas:

```typescript
export const getRealSellers = async (): Promise<Seller[]> => {
  const rawData = await fetchNoco<any>(NOCODB_CONFIG.TABLE_IDS.SELLERS, 'Vendedoras');
  if (rawData.length === 0) return [];

  return rawData
    .filter(item => {
      const estado = (item.Estado || '').toLowerCase();
      return estado !== 'inactivo' && estado !== 'despedido' && 
             estado !== 'suspendido' && estado !== 'baja voluntaria' && 
             estado !== 'baja involuntaria';
    })
    .map(item => ({
      id: String(item.Id || item.id),
      name: item['Nombre de la Vendedora'] || item.Name || item.Nombre || 'Sin Nombre',
      avatarUrl: extractImage(item.Foto || item.Avatar || item.Imagen)
    }));
};
```

---

### Paso 9: Optimizar Rendimiento con Filtros del Servidor 🔴 URGENTE

**¿Dónde?** Archivo `services/noco.ts` y `services/dataService.ts`

**Concepto:** Pasar el rango de fechas como query param `where` a NocoDB, para que el servidor filtre en vez del cliente.

**En `noco.ts`, modificar funciones para aceptar filtro de fechas:**

```typescript
export const getRealInteractions = async (startDate?: Date, endDate?: Date): Promise<Interaction[]> => {
  let queryParams = '';
  if (startDate && endDate) {
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    queryParams = `where=(Fecha,gte,${start})~and(Fecha,lte,${end})`;
  }
  const rawData = await fetchNoco<any>(NOCODB_CONFIG.TABLE_IDS.INTERACTIONS, 'Interacciones', queryParams);
  // ... rest of mapping
};
```

Hacer lo mismo para `getRealSales` y `getRealAttempts`.

**En `dataService.ts`, remover los filter del cliente:**
```typescript
// ANTES:
interactions: realInteractions.filter(i => isWithinRange(i.date)),
// DESPUÉS:
interactions: realInteractions, // Ya filtradas por el servidor
```

---

### Paso 10: Mejorar Seguridad del Token 🔴 RECOMENDADO

**Opciones (menor a mayor seguridad):**

1. **Mínimo viable (hacer ahora):**
   - Verificar que el token en NocoDB sea de **solo lectura** (rol Viewer)
   - Crear un token nuevo de solo lectura si el actual tiene más permisos

2. **Solución media (recomendada):**
   - Crear una Serverless Function (Vercel/Netlify) como proxy
   - El frontend llama al proxy, el proxy llama a NocoDB con el token
   - El token nunca se expone al usuario

3. **Solución completa:**
   - Usar la tabla `Dashboard_Cache` (que ya existe) para almacenar métricas pre-calculadas
   - Un cron job (n8n) actualiza la cache cada hora
   - El dashboard lee solo de la cache (un registro JSON vs 37K registros)

---

## 10. Recomendaciones de Mejora a Futuro

### Prioridad Alta

1. **Implementar la tabla Dashboard_Cache** para pre-calcular métricas. Esto resolvería rendimiento Y seguridad.

2. **Automatizar el registro de ventas** via n8n workflow:
   - System.io/Hotmart webhook → n8n → NocoDB Ventas table

3. **Agregar Estado del Pago** al mapper para filtrar ventas no pagadas.

### Prioridad Media

4. **Usar el campo `Apellido`** de Contactos para mostrar nombre completo.

5. **Usar el campo `EstimatedValue`** de Contactos para mostrar pipeline value (valor estimado de leads activos).

6. **Usar la tabla Productos** para mostrar desglose de ventas por producto/categoría.

7. **Integrar Etiquetas** para segmentar análisis por fuente de captación (Lead Magnet, ManyChat, etc.).

8. **Migrar Tailwind de CDN a PostCSS** para producción optimizada.

### Prioridad Baja

9. **Implementar caching en el frontend** (React Query, SWR, o similar).

10. **Agregar dark/light mode toggle** (actualmente está hardcodeado en dark).

11. **Usar la tabla `Procesos y Sistemas`** para crear una sección de documentación interna accesible desde el dashboard.

12. **Eliminar el campo `Contraseña Nocodb`** de la tabla Vendedoras o migrar a un sistema seguro.

---

## Apéndice A: Esquema Completo de Relaciones NocoDB

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Vendedoras │     │  Contactos   │     │  Etiquetas  │
│             │◄────│              │───M:M│             │
│ 3 registros │     │ 27,676 reg   │     │             │
└──────┬──────┘     └──────┬───────┘     └─────────────┘
       │                   │
       │                   ├─────────────────────────┐
       │                   │                         │
       ▼                   ▼                         ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│ Interacciones│    │   Ventas     │    │ Intentos Compra  │
│ 10,524 reg   │    │ 1 reg (vacío)│    │ 1 reg (vacío)    │
└──────────────┘    └──────┬───────┘    └──────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Productos   │
                    │              │
                    └──────────────┘
```

---

## Apéndice B: Variables de Entorno (.env)

```env
# ✅ Correcto
VITE_NOCODB_URL=https://app.nocodb.com

# ⚠️ Expuesto al frontend (ver S1)
VITE_NOCODB_TOKEN=6CsjyiTJ...

# ✅ Correctos y verificados contra esquema
VITE_TABLE_SELLERS=me6kwgo0qvg0aug
VITE_TABLE_CONTACTS=mrwhtwissgz1xzr
VITE_TABLE_INTERACTIONS=m6gx25reozjbbt3
VITE_TABLE_SALES=mm9p02mlk0i5ysy
VITE_TABLE_ATTEMPTS=mqdlglkwjvvtplc
```

Todos los IDs de tabla son correctos y coinciden con el esquema real de NocoDB. ✅

---

*Documento generado automáticamente por Antigravity AI — 11/02/2026*
