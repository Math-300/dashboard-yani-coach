# Análisis de Rendimiento de Carga de Métricas

## Resumen Ejecutivo

El dashboard presenta problemas críticos de rendimiento causados principalmente por:
1. **Rate Limiting (Error 429)** - NocoDB rechaza peticiones simultáneas
2. **Falta de cache** - Cada cambio de fecha recarga todos los datos
3. **Cálculos en cliente** - Todas las métricas se calculan en el frontend
4. **Filtrado ineficiente** - Se traen TODOS los registros y se filtran en cliente

---

## 1. Cuellos de Botella Identificados

### 1.1 Error 429 - Rate Limiting de NocoDB (CRÍTICO)

**Problema detectado en logs:**
```
GET https://app.nocodb.com/api/v2/tables/.../records 429 (Too Many Requests)
ThrottlerException: Too Many Requests
```

**Causa raíz:**
En [`dataService.ts:120-126`](services/dataService.ts:120), se ejecutan 5 peticiones simultáneas con `Promise.all()`:
```typescript
const [realSellers, realContacts, realInteractions, realSales, realAttempts] = await Promise.all([
  getRealSellers(),
  getRealContacts(),
  getRealInteractions(),
  getRealSales(),
  getRealAttempts()
]);
```

**Impacto:**
- NocoDB tiene un límite de ~3-5 peticiones simultáneas
- Al hacer 5 peticiones en paralelo, se excede el límite
- Resultado: datos vacíos, dashboard roto

### 1.2 Paginación Ineficiente

**Problema en [`noco.ts:176-296`](services/noco.ts:176):**
- Se usa `limit=1000` pero NocoDB ignora esto y devuelve máximo 100 registros por página
- Si hay 500+ registros, se necesitan múltiples llamadas
- Cada llamada adicional consume más rate limit

### 1.3 Filtrado del Lado del Cliente

**Problema en [`dataService.ts:131-133`](services/dataService.ts:131):**
```typescript
interactions: realInteractions.filter(i => isWithinRange(i.date)),
sales: realSales.filter(s => isWithinRange(s.date)),
attempts: realAttempts.filter(a => isWithinRange(a.date)),
```

**Impacto:**
- Se descargan TODOS los registros históricos
- El filtrado por fecha se hace en el navegador
- Ancho de banda desperdiciado

### 1.4 Cálculos Costosos en el Cliente

**Funciones pesadas en [`metricsCalculator.ts`](services/metricsCalculator.ts):**

| Función | Líneas | Complejidad | Problema |
|---------|--------|-------------|----------|
| `calculateSalesByVendor` | 560-667 | O(n×m) | Múltiples forEach anidados |
| `calculateInteractionsByVendor` | 676-722 | O(n×m) | Itera todas las interacciones |
| `calculateConversionByVendor` | 731-771 | O(n×m) | Filtra contactos por vendedora |
| `calculateSalesTrend` | 466-522 | O(n) | Agrupa por período |

**Problema:**
- Cada vez que cambia el rango de fechas, se recalculan TODAS las métricas
- No hay memoización de resultados parciales
- Los componentes re-renderizan completamente

---

## 2. Propuesta de Optimización para NocoDB

### 2.1 Columnas Calculadas a Agregar en NocoDB

#### Tabla: Contactos (mrwhtwissgz1xzr)

| Columna | Tipo | Fórmula/Descripción |
|---------|------|---------------------|
| `Is_Active` | Formula | `IF(OR({Estado Actual}='Lead Nuevo', {Estado Actual}='En Seguimiento', {Estado Actual}='Interesado'), TRUE, FALSE)` |
| `Days_In_Pipeline` | Formula | `DATETIME_DIFF(NOW(), {Fecha y hora de creación}, 'days')` |
| `Is_Won` | Formula | `IF({Estado Actual}='Venta Ganada', TRUE, FALSE)` |
| `Is_Lost` | Formula | `IF({Estado Actual} LIKE '%Perdida%', TRUE, FALSE)` |
| `Month_Created` | Formula | `DATETIME_FORMAT({Fecha y hora de creación}, 'YYYY-MM')` |

#### Tabla: Ventas (mm9p02mlk0i5ysy)

| Columna | Tipo | Fórmula/Descripción |
|---------|------|---------------------|
| `Month_Sold` | Formula | `DATETIME_FORMAT({Fecha}, 'YYYY-MM')` |
| `Week_Sold` | Formula | `DATETIME_FORMAT({Fecha}, 'YYYY-WW')` |
| `Product_Category` | Formula | `IF(CONTAINS({Producto Vendido}, 'Premium'), 'Premier', IF(CONTAINS({Producto Vendido}, 'Digital'), 'Digital', 'Otros'))` |
| `Is_This_Month` | Formula | `DATETIME_FORMAT({Fecha}, 'YYYY-MM') = DATETIME_FORMAT(NOW(), 'YYYY-MM')` |

#### Tabla: Interacciones (m6gx25reozjbbt3)

| Columna | Tipo | Fórmula/Descripción |
|---------|------|---------------------|
| `Month` | Formula | `DATETIME_FORMAT({Fecha}, 'YYYY-MM')` |
| `Is_This_Month` | Formula | `DATETIME_FORMAT({Fecha}, 'YYYY-MM') = DATETIME_FORMAT(NOW(), 'YYYY-MM')` |

### 2.2 Vistas Agregadas en NocoDB

Crear vistas con filtros predefinidos:

1. **Vista "Contactos Activos"** - Filtro: `Is_Active = TRUE`
2. **Vista "Ventas Este Mes"** - Filtro: `Is_This_Month = TRUE`
3. **Vista "Interacciones Recientes"** - Filtro: `Fecha >= TODAY()-30`

---

## 3. Estrategia de Uso de Tabla "Dashboard Cache"

### 3.1 Estructura Propuesta

Crear tabla `dashboard_cache` con la siguiente estructura:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `Id` | Auto Number | PK |
| `Cache_Key` | Single Select | Valores: `daily_metrics`, `vendor_stats`, `monthly_summary` |
| `Cache_Date` | Date | Fecha de los datos cacheados |
| `Data_JSON` | LongText | JSON con datos precalculados |
| `Last_Updated` | DateTime | Última actualización |
| `Record_Count` | Number | Cantidad de registros procesados |

### 3.2 Datos a Pre-calcular

#### Cache Key: `daily_metrics`
```json
{
  "date": "2026-02-21",
  "total_leads_pipeline": 45,
  "new_leads_today": 3,
  "sales_today": { "count": 2, "amount": 1500000 },
  "conversion_rate": 78,
  "urgent_followups": 5,
  "pipeline_value": 45000000
}
```

#### Cache Key: `vendor_stats`
```json
{
  "vendors": [
    {
      "id": "1",
      "name": "Ana Garcia",
      "sales_count": 15,
      "sales_amount": 25000000,
      "conversion_rate": 85,
      "active_leads": 12
    }
  ]
}
```

#### Cache Key: `monthly_summary`
```json
{
  "month": "2026-02",
  "total_sales": 45,
  "total_revenue": 85000000,
  "by_product": [
    { "name": "Premium", "count": 20, "revenue": 40000000 }
  ],
  "by_category": [
    { "category": "Premier", "revenue": 50000000, "percentage": 59 }
  ]
}
```

### 3.3 Automatización de Actualización

**Opción A: Webhook desde NocoDB**
- Configurar webhook en cada tabla que dispare actualización del cache
- Usar n8n o Zapier para procesar

**Opción B: Script Programado**
- Ejecutar cada hora o cada día
- Calcular métricas y guardar en tabla cache

---

## 4. Cambios de Código Recomendados

### 4.1 Implementar Rate Limiting con Reintentos

```typescript
// services/noco.ts - Agregar función de retry con delay
const fetchWithRetry = async (fn: () => Promise<any>, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.status === 429 && i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        continue;
      }
      throw error;
    }
  }
};
```

### 4.2 Carga Secuencial con Delay

```typescript
// services/dataService.ts - Reemplazar Promise.all con carga secuencial
const fetchSequentially = async () => {
  const sellers = await getRealSellers();
  await delay(200); // 200ms entre peticiones
  
  const contacts = await getRealContacts();
  await delay(200);
  
  const interactions = await getRealInteractions();
  await delay(200);
  
  const sales = await getRealSales();
  await delay(200);
  
  const attempts = await getRealAttempts();
  
  return { sellers, contacts, interactions, sales, attempts };
};
```

### 4.3 Filtrado del Lado del Servidor

```typescript
// services/noco.ts - Agregar parámetros de filtro
const fetchFromProxy = async <T>(
  endpoint: string, 
  label: string,
  dateFilter?: { start: Date; end: Date }
): Promise<T[]> => {
  let whereClause = '';
  if (dateFilter) {
    const startStr = dateFilter.start.toISOString().split('T')[0];
    const endStr = dateFilter.end.toISOString().split('T')[0];
    whereClause = `&where=(Fecha,gte,${startStr})~and(Fecha,lte,${endStr})`;
  }
  // ... resto del código
};
```

### 4.4 Cache del Lado del Cliente

```typescript
// services/cacheService.ts - Nuevo archivo
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class DashboardCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutos

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T, ttl = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

export const dashboardCache = new DashboardCache();
```

### 4.5 Memoización de Cálculos

```typescript
// hooks/useMetrics.ts - Nuevo hook con memoización
import { useMemo } from 'react';
import { calculateSalesByVendor, calculateMonthlySales } from '../services/metricsCalculator';

export const useMetrics = (sales: Sale[], contacts: Contact[], dateRange: DateRange) => {
  const salesInRange = useMemo(() => 
    sales.filter(s => {
      const date = new Date(s.date);
      return date >= dateRange.start && date <= dateRange.end;
    }),
    [sales, dateRange.start, dateRange.end]
  );

  const vendorPerformance = useMemo(
    () => calculateSalesByVendor(salesInRange, contacts),
    [salesInRange, contacts]
  );

  const monthlySales = useMemo(
    () => calculateMonthlySales(salesInRange, dateRange),
    [salesInRange, dateRange]
  );

  return { vendorPerformance, monthlySales };
};
```

---

## 5. Estimación de Mejora Esperada

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Tiempo de carga inicial | 8-15s | 2-4s | 60-75% |
| Llamadas API por carga | 5-15 | 1-3 | 70-80% |
| Errores 429 | Frecuentes | Raros | 95% |
| Uso de ancho de banda | Alto | Bajo | 50-70% |
| Tiempo de recálculo métricas | 500-1000ms | 50-100ms | 80-90% |

### Factores de Mejora:

1. **Eliminación de rate limiting**: Carga secuencial con delays evita errores 429
2. **Filtrado server-side**: Reduce datos transferidos en 70-90%
3. **Cache cliente**: Evita recargas innecesarias al cambiar fechas
4. **Memoización**: Evita recálculos cuando los datos no cambian
5. **Pre-cálculo NocoDB**: Mueve cálculos pesados al servidor

---

## 6. Plan de Implementación

### Fase 1: Corrección Urgente (1-2 días)
- [ ] Implementar carga secuencial con delays
- [ ] Agregar reintentos con backoff exponencial
- [ ] Manejar errores 429 graciosamente

### Fase 2: Optimización de Datos (3-5 días)
- [ ] Agregar columnas calculadas en NocoDB
- [ ] Implementar filtrado server-side
- [ ] Crear servicio de cache cliente

### Fase 3: Cache Avanzado (1 semana)
- [ ] Configurar tabla dashboard_cache
- [ ] Implementar actualización automática
- [ ] Crear endpoints de cache en API

### Fase 4: Optimización de Renderizado (3-5 días)
- [ ] Implementar hooks memoizados
- [ ] Virtualizar listas largas
- [ ] Lazy loading de componentes

---

## 7. Conclusión

El problema principal es el **Rate Limiting de NocoDB** causado por peticiones simultáneas. La solución inmediata es implementar carga secuencial con delays. La solución a largo plazo incluye filtrado server-side, cache del cliente y pre-cálculo de métricas en NocoDB.

La implementación de la tabla `dashboard_cache` puede reducir drásticamente el tiempo de carga al pre-calcular métricas agregadas, pero requiere configuración de automatizaciones en NocoDB o un servicio externo.
