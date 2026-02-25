# Análisis de Arquitectura y Oportunidades de Refactorización

**Fecha:** 2026-02-21  
**Proyecto:** Dashboard Yani Coach  
**Alcance:** Análisis profundo de arquitectura, duplicación de código y oportunidades de mejora

---

## Resumen Ejecutivo

El proyecto Dashboard Yani Coach presenta una arquitectura funcional y bien organizada en términos generales. Sin embargo, se han identificado **oportunidades de refactorización significativas** que mejorarían la mantenibilidad, reducirían la duplicación de código y optimizarían el rendimiento.

### Veredicto General

| Aspecto | Estado | Acción Recomendada |
|---------|--------|-------------------|
| Duplicación de código | ⚠️ Moderado | Refactorización recomendada |
| Tamaño de archivos | ⚠️ Moderado | División opcional |
| Responsabilidades | ✅ Aceptable | Mejoras incrementales |
| Tipado | ✅ Bueno | Mejoras menores |
| Performance | ⚠️ Moderado | Optimización recomendada |

**Conclusión:** La refactorización es **recomendada pero no urgente**. El código funciona correctamente, pero invertir en mejoras arquitectónicas reducirá la deuda técnica futura.

---

## 1. Problemas Identificados

### 1.1 Duplicación de Código en Componentes de Vistas (ALTA PRIORIDAD)

#### Patrón Repetido: Inicialización de Gráficos G2

Todos los componentes de vistas repiten el mismo patrón para inicializar gráficos:

```typescript
// Patrón repetido en ExecutiveView, SalesView, PerformanceView, PipelineView, etc.
const chartRef = useRef<HTMLDivElement>(null);
const chartInstanceRef = useRef<any>(null);

useEffect(() => {
    let isMounted = true;
    
    const renderChart = async () => {
        if (!chartRef.current || !data.length) return;
        
        try {
            const { Chart } = await import('@antv/g2');
            if (!isMounted || !chartRef.current) return;
            
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
            
            const chart = new Chart({
                container: chartRef.current,
                autoFit: true,
                height: 300
            });
            chartInstanceRef.current = chart;
            chart.options({ /* configuración */ });
            chart.render();
        } catch (error) {
            console.error('Error renderizando gráfico:', error);
        }
    };
    
    renderChart();
    
    return () => {
        isMounted = false;
        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
            chartInstanceRef.current = null;
        }
    };
}, [dependencies]);
```

**Impacto:** Este patrón se repite **múltiples veces** en cada componente:
- [`ExecutiveView.tsx`](../components/ExecutiveView.tsx): 1 gráfico
- [`SalesView.tsx`](../components/SalesView.tsx): 3 gráficos
- [`PerformanceView.tsx`](../components/PerformanceView.tsx): 3 gráficos
- [`PipelineView.tsx`](../components/PipelineView.tsx): 6 gráficos

**Total estimado:** ~13 bloques de código duplicado solo para inicialización de gráficos.

#### Patrón Repetido: Cálculo de Métricas con useMemo

Cada componente tiene un bloque similar:

```typescript
const metrics = useMemo(() => {
    const metric1 = calculateMetric1(data);
    const metric2 = calculateMetric2(data);
    // ... más cálculos
    return { metric1, metric2, ... };
}, [dependencies]);
```

### 1.2 Tamaño de Archivos (PRIORIDAD MEDIA)

| Archivo | Tamaño | Líneas Estimadas | Estado |
|---------|--------|------------------|--------|
| [`metricsCalculator.ts`](../services/metricsCalculator.ts) | 46KB | ~1400 | ⚠️ Grande |
| [`PipelineView.tsx`](../components/PipelineView.tsx) | 31KB | ~700 | ⚠️ Grande |
| [`PerformanceView.tsx`](../components/PerformanceView.tsx) | 30KB | ~650 | ⚠️ Grande |
| [`SalesView.tsx`](../components/SalesView.tsx) | 26KB | ~570 | ⚠️ Grande |
| [`RecoveryView.tsx`](../components/RecoveryView.tsx) | 21KB | ~450 | ✅ Aceptable |
| [`noco.ts`](../services/noco.ts) | 19KB | ~450 | ✅ Aceptable |
| [`BusinessView.tsx`](../components/BusinessView.tsx) | 19KB | ~400 | ✅ Aceptable |
| [`TeamView.tsx`](../components/TeamView.tsx) | 14KB | ~320 | ✅ Aceptable |
| [`ExecutiveView.tsx`](../components/ExecutiveView.tsx) | 14KB | ~306 | ✅ Aceptable |

**Análisis:**
- Los archivos grandes NO son problemáticos per se si tienen cohesión
- `metricsCalculator.ts` tiene 35+ funciones exportadas que podrían agruparse
- Los componentes de vistas son grandes principalmente por la duplicación de patrones de gráficos

### 1.3 Responsabilidades Mezcladas (PRIORIDAD MEDIA)

Los componentes de vistas tienen múltiples responsabilidades:

1. **Cálculo de métricas** (delegado a metricsCalculator)
2. **Gestión de estado de gráficos** (refs, instancias)
3. **Renderizado de gráficos** (configuración G2)
4. **Presentación de UI** (KPIs, layouts)

**Problema:** La lógica de gráficos está acoplada a cada componente en lugar de estar encapsulada.

### 1.4 Performance y Memoización (PRIORIDAD MEDIA)

#### Importaciones Dinámicas de G2

```typescript
const { Chart } = await import('@antv/g2');
```

**Problema:** Cada gráfico importa G2 dinámicamente de forma independiente. No hay caching de la importación.

#### Falta de Memoización en Cálculos Costosos

Algunas funciones en `metricsCalculator.ts` realizan operaciones que podrían beneficiarse de memoización cuando se llaman múltiples veces con los mismos datos.

### 1.5 Tipado (PRIORIDAD BAJA)

#### Uso de `any` en Referencias de Gráficos

```typescript
const chartInstanceRef = useRef<any>(null);
```

**Problema:** Falta de tipado seguro para las instancias de gráficos G2.

#### Tipos Exportados desde metricsCalculator

Los tipos como `ProductRevenue`, `CategoryRevenue`, `TrendData` se exportan desde `metricsCalculator.ts` pero podrían estar en `types.ts` para mejor organización.

---

## 2. Oportunidades de Refactorización Priorizadas

### 🔴 PRIORIDAD ALTA: Custom Hook para Gráficos G2

**Impacto:** Alto | **Esfuerzo:** Medio | **ROI:** Muy Alto

Crear un custom hook que encapsule toda la lógica de inicialización, renderizado y cleanup de gráficos G2.

#### Propuesta de Implementación

```typescript
// hooks/useG2Chart.ts
import { useEffect, useRef, useCallback } from 'react';

interface ChartOptions {
  type: 'interval' | 'area' | 'line' | 'point';
  data: any[];
  encode: Record<string, string>;
  scale?: Record<string, any>;
  axis?: Record<string, any>;
  legend?: boolean;
  labels?: any[];
  tooltip?: any;
  coordinate?: any;
  style?: any;
  height?: number;
}

export const useG2Chart = <T extends HTMLElement>(
  options: ChartOptions,
  dependencies: any[]
) => {
  const containerRef = useRef<T>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    const renderChart = async () => {
      if (!containerRef.current || options.data.length === 0) return;

      try {
        const { Chart } = await import('@antv/g2');
        
        if (!isMounted || !containerRef.current) return;

        if (chartInstanceRef.current) {
          chartInstanceRef.current.destroy();
        }

        const chart = new Chart({
          container: containerRef.current,
          autoFit: true,
          height: options.height ?? 300
        });

        chartInstanceRef.current = chart;

        chart.options({
          type: options.type,
          data: options.data,
          encode: options.encode,
          scale: options.scale,
          axis: options.axis,
          legend: options.legend,
          labels: options.labels,
          tooltip: options.tooltip,
          coordinate: options.coordinate,
          style: options.style
        });

        chart.render();
      } catch (error) {
        console.error('Error rendering G2 chart:', error);
      }
    };

    renderChart();

    return () => {
      isMounted = false;
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, dependencies);

  return containerRef;
};
```

#### Ejemplo de Uso en Componente

```typescript
// Antes (ExecutiveView.tsx - 80+ líneas para un gráfico)
const chartRef = useRef<HTMLDivElement>(null);
const chartInstanceRef = useRef<any>(null);

useEffect(() => {
  let isMounted = true;
  const renderChart = async () => {
    // ... 60+ líneas de código
  };
  renderChart();
  return () => { /* cleanup */ };
}, [metrics.funnelData, isDarkMode]);

// Después (usando el hook)
const funnelChartRef = useG2Chart(
  {
    type: 'interval',
    data: [...metrics.funnelData].reverse(),
    encode: { x: 'count', y: 'status', color: 'status' },
    scale: { color: { range: colors } },
    axis: { x: { title: 'Cantidad de Leads' }, y: { title: false } },
    legend: false,
    labels: [{ text: (d: FunnelStep) => `${d.count} (${d.percentage}%)`, position: 'right' }]
  },
  [metrics.funnelData, isDarkMode]
);

return <div ref={funnelChartRef} className="w-full min-h-[400px]" />;
```

**Beneficios:**
- Reducción de ~70 líneas por gráfico
- Consistencia en manejo de errores y cleanup
- Tipado mejorado
- Testing más fácil

---

### 🟠 PRIORIDAD MEDIA: División de metricsCalculator.ts

**Impacto:** Medio | **Esfuerzo:** Bajo | **ROI:** Medio

Dividir el archivo en módulos por dominio:

```
services/
├── metrics/
│   ├── index.ts              # Re-exports todo
│   ├── pipelineMetrics.ts    # calculateTotalLeadsInPipeline, calculateFunnelByStatus, etc.
│   ├── salesMetrics.ts       # calculateTotalRevenue, calculateRevenueByProduct, etc.
│   ├── vendorMetrics.ts      # calculateSalesByVendor, calculateInteractionsByVendor, etc.
│   ├── interactionMetrics.ts # calculateInteractionsByChannel, calculateInteractionResults, etc.
│   ├── recoveryMetrics.ts    # calculateRecoveryMetrics, calculateRecoveryByVendor, etc.
│   └── formatters.ts         # formatCurrency, formatNumber
```

#### Categorización de Funciones

| Categoría | Funciones | Cantidad |
|-----------|-----------|----------|
| Pipeline | `calculateTotalLeadsInPipeline`, `calculateNewLeadsToday`, `calculateConversionRate`, `calculateUrgentFollowUps`, `calculatePipelineValue`, `calculateFunnelByStatus`, `calculateLeadsByStatus`, `calculateLostReasons`, `calculateLeadsBySource`, `calculateLeadsByCountry`, `calculateLostLeads` | 11 |
| Sales | `calculateTotalRevenue`, `calculateAverageTicket`, `calculateTotalDiscounts`, `calculateRevenueByProduct`, `calculateRevenueByCategory`, `calculateSalesTrend`, `calculateMonthlySales` | 7 |
| Vendor | `calculateSalesByVendor`, `calculateInteractionsByVendor`, `calculateConversionByVendor`, `calculateAvgClosingTimeByVendor`, `calculateActiveLeadsByVendor`, `calculatePendingFollowUpsByVendor` | 6 |
| Interaction | `calculateInteractionsByChannel`, `calculateInteractionResults`, `calculateAvgInteractionsPerLead`, `calculateTotalInteractions` | 4 |
| Recovery | `calculatePurchaseAttemptsByStatus`, `calculateRecoveryMetrics`, `calculateRecoveryByVendor`, `calculateAttemptTrends`, `calculateFailedAttempts`, `calculateRecoveredValue` | 6 |
| Formatters | `formatCurrency`, `formatNumber` | 2 |

---

### 🟠 PRIORIDAD MEDIA: Componentes de Gráficos Reutilizables

**Impacto:** Medio | **Esfuerzo:** Medio | **ROI:** Medio

Crear componentes wrapper para los tipos de gráficos más comunes:

```typescript
// components/charts/BarChart.tsx
interface BarChartProps {
  data: any[];
  xField: string;
  yField: string;
  colorField?: string;
  title?: string;
  height?: number;
  colorRange?: string[];
  tooltipItems?: TooltipItem[];
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  xField,
  yField,
  colorField,
  title,
  height = 300,
  colorRange,
  tooltipItems
}) => {
  const chartRef = useG2Chart(
    {
      type: 'interval',
      data,
      encode: { x: xField, y: yField, color: colorField },
      scale: colorRange ? { color: { range: colorRange } } : undefined,
      axis: { x: { title }, y: { title: false } },
      tooltip: tooltipItems ? { items: tooltipItems } : undefined,
      height
    },
    [data]
  );

  return <div ref={chartRef} className="w-full" style={{ minHeight: height }} />;
};
```

**Gráficos comunes identificados:**
- `BarChart` (barras horizontales/verticales)
- `AreaChart` (área para tendencias)
- `DonutChart` (dona para distribución)
- `FunnelChart` (embudo)

---

### 🟡 PRIORIDAD BAJA: Mejoras de Tipado

**Impacto:** Bajo | **Esfuerzo:** Bajo | **ROI:** Bajo

1. **Mover tipos de métricas a types.ts:**

```typescript
// types.ts - agregar sección de tipos de métricas
export interface ProductRevenue {
  productName: string;
  quantity: number;
  revenue: number;
  percentage: number;
}

export interface CategoryRevenue {
  category: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface TrendData {
  period: string;
  date: string;
  revenue: number;
  count: number;
}
```

2. **Tipar correctamente las instancias de Chart:**

```typescript
import type { Chart } from '@antv/g2';

const chartInstanceRef = useRef<Chart | null>(null);
```

---

### 🟡 PRIORIDAD BAJA: Optimización de Importaciones G2

**Impacto:** Bajo | **Esfuerzo:** Bajo | **ROI:** Bajo

Crear un módulo de importación con cache:

```typescript
// utils/g2Loader.ts
let g2Module: typeof import('@antv/g2') | null = null;

export const loadG2 = async () => {
  if (!g2Module) {
    g2Module = await import('@antv/g2');
  }
  return g2Module;
};
```

---

## 3. Evaluación de Necesidad de Refactorización

### ¿Es Necesario Refactorizar Ahora?

| Factor | Evaluación |
|--------|------------|
| **Funcionalidad actual** | ✅ El código funciona correctamente |
| **Deuda técnica** | ⚠️ Moderada - duplicación significativa |
| **Mantenibilidad** | ⚠️ Media - cambios requieren modificar múltiples archivos |
| **Onboarding de nuevos desarrolladores** | ⚠️ Medio - patrones repetidos pueden confundir |
| **Riesgo de bugs** | ✅ Bajo - el código está bien estructurado |
| **Performance** | ✅ Aceptable - no hay problemas críticos |

### Recomendación

**Refactorización gradual recomendada** en el siguiente orden:

1. **Inmediato (esta iteración):** Crear `useG2Chart` hook
2. **Corto plazo (próxima iteración):** Dividir `metricsCalculator.ts`
3. **Mediano plazo:** Crear componentes de gráficos reutilizables
4. **Continuo:** Mejoras incrementales de tipado

---

## 4. Plan de Implementación Sugerido

### Fase 1: Custom Hook useG2Chart

1. Crear archivo `hooks/useG2Chart.ts`
2. Implementar hook con soporte para todas las opciones de G2
3. Migrar un componente como prueba (ExecutiveView)
4. Validar funcionamiento
5. Migrar resto de componentes gradualmente

### Fase 2: División de metricsCalculator

1. Crear estructura de carpetas `services/metrics/`
2. Mover funciones por categoría
3. Crear `index.ts` con re-exports
4. Actualizar imports en componentes
5. Validar que no hay regresiones

### Fase 3: Componentes de Gráficos

1. Identificar patrones comunes de gráficos
2. Crear componentes base
3. Migrar gradualmente

---

## 5. Métricas de Éxito

| Métrica | Actual | Objetivo |
|---------|--------|----------|
| Líneas de código duplicado | ~1000 | <200 |
| Tamaño máximo de archivo | 46KB | <25KB |
| Tiempo para agregar nuevo gráfico | ~80 líneas | ~10 líneas |
| Cobertura de tipos | ~85% | >95% |

---

## 6. Conclusión

El proyecto Dashboard Yani Coach tiene una base sólida pero presenta oportunidades claras de mejora. La **creación de un custom hook para gráficos G2** es la refactorización de mayor impacto y menor riesgo, y debería ser la primera prioridad.

La refactorización puede realizarse de forma **incremental sin afectar la funcionalidad existente**, lo que permite continuar con el desarrollo de nuevas features mientras se mejora la arquitectura.

**Recomendación final:** Proceder con la refactorización del hook `useG2Chart` como primer paso, y evaluar los resultados antes de continuar con las demás mejoras.
