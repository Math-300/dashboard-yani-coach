# Plan de Migración de Gráficos: G2 → Recharts

## Resumen

Migrar todos los gráficos del dashboard de **@antv/g2** a **Recharts** para mejorar:
- Compatibilidad con React y Tailwind CSS
- Diseño responsive automático
- Facilidad de mantenimiento
- Consistencia visual

## Estado Actual

### Componentes con Recharts (Ya migrados)
- ✅ `BusinessView.tsx` - 5 gráficos funcionando correctamente
- ✅ `TeamView.tsx` - 1 gráfico funcionando correctamente

### Componentes con G2 (Necesitan migración)
- ❌ `ExecutiveView.tsx` - 1 gráfico (embudo)
- ❌ `SalesView.tsx` - 3 gráficos (tendencia, productos, categorías)
- ❌ `PipelineView.tsx` - 6 gráficos
- ❌ `RecoveryView.tsx` - 4 gráficos
- ❌ `PerformanceView.tsx` - 3 gráficos

## Arquitectura de Recharts

### Importaciones Comunes
```typescript
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, ComposedChart
} from 'recharts';
```

### Estructura Responsive
```tsx
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={data} layout="vertical">
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis type="number" />
    <YAxis dataKey="name" type="category" />
    <Tooltip />
    <Bar dataKey="value" fill="#D4AF37" />
  </BarChart>
</ResponsiveContainer>
```

### Colores del Tema
```typescript
// Colores para modo claro/oscuro
const axisColor = isDarkMode ? '#9ca3af' : '#4b5563';
const gridColor = isDarkMode ? '#374151' : '#e5e7eb';
const tooltipBg = isDarkMode ? '#1f2937' : '#ffffff';
const tooltipBorder = isDarkMode ? '#374151' : '#e5e7eb';
const tooltipText = isDarkMode ? '#f3f4f6' : '#1f2937';

// Colores de la marca
const COLORS = {
  gold: '#D4AF37',
  green: '#22c55e',
  blue: '#3b82f6',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6'
};
```

## Plan de Migración por Componente

### 1. ExecutiveView.tsx - Gráfico de Embudo

**Actual (G2):**
```typescript
renderChart({
    type: 'interval',
    data: chartData,
    encode: { x: 'displayCount', y: 'status', color: 'status' }
});
```

**Nuevo (Recharts):**
```tsx
<ResponsiveContainer width="100%" height={400}>
  <BarChart layout="vertical" data={funnelData}>
    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
    <XAxis type="number" title="Cantidad de Contactos" />
    <YAxis dataKey="status" type="category" width={120} />
    <Tooltip 
      contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder }}
      formatter={(value, name) => [`${value} contactos`, name]}
    />
    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
      {funnelData.map((entry, index) => (
        <Cell key={`cell-${index}`} fill={statusColors[entry.status]} />
      ))}
    </Bar>
  </BarChart>
</ResponsiveContainer>
```

### 2. SalesView.tsx - 3 Gráficos

#### 2.1 Tendencia de Ventas (AreaChart)
```tsx
<ResponsiveContainer width="100%" height={300}>
  <AreaChart data={salesTrend}>
    <defs>
      <linearGradient id="colorGold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.8}/>
        <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.1}/>
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip />
    <Area type="monotone" dataKey="amount" stroke="#D4AF37" fill="url(#colorGold)" />
  </AreaChart>
</ResponsiveContainer>
```

#### 2.2 Ingresos por Producto (BarChart horizontal)
```tsx
<ResponsiveContainer width="100%" height={300}>
  <BarChart layout="vertical" data={productRevenue}>
    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
    <XAxis type="number" />
    <YAxis dataKey="product" type="category" width={100} />
    <Tooltip formatter={(value) => formatCurrency(value as number)} />
    <Bar dataKey="revenue" fill="#D4AF37" radius={[0, 4, 4, 0]} />
  </BarChart>
</ResponsiveContainer>
```

#### 2.3 Ingresos por Categoría (BarChart)
```tsx
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={categoryRevenue}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="category" />
    <YAxis />
    <Tooltip formatter={(value) => formatCurrency(value as number)} />
    <Bar dataKey="revenue" fill="#D4AF37" radius={[4, 4, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

### 3. PipelineView.tsx - 6 Gráficos

Todos los gráficos de PipelineView son de barras horizontales con la misma estructura:

```tsx
<ResponsiveContainer width="100%" height={300}>
  <BarChart layout="vertical" data={data}>
    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
    <XAxis type="number" />
    <YAxis dataKey="label" type="category" width={100} />
    <Tooltip />
    <Bar dataKey="value" fill="#D4AF37" radius={[0, 4, 4, 0]} />
  </BarChart>
</ResponsiveContainer>
```

### 4. RecoveryView.tsx - 4 Gráficos

Estructura similar a PipelineView con barras horizontales.

### 5. PerformanceView.tsx - 3 Gráficos

#### 5.1 Ventas por Vendedora (BarChart)
#### 5.2 Interacciones por Vendedora (BarChart apilado)
#### 5.3 Tasa de Conversión (BarChart con colores condicionales)

## Beneficios de la Migración

1. **Responsive automático**: `ResponsiveContainer` ajusta el tamaño automáticamente
2. **Consistencia**: Todos los gráficos usarán el mismo sistema de colores y estilos
3. **Mantenimiento**: Una sola dependencia de gráficos
4. **Tailwind CSS**: Integración nativa con clases de utilidad
5. **Tooltips**: Personalización fácil con estilos del tema

## Dependencias a Eliminar

```json
{
  "dependencies": {
    "@antv/g2": "^5.x.x"  // Eliminar después de la migración
  }
}
```

## Archivos a Eliminar

- `hooks/useG2Chart.ts` - Hook personalizado para G2

## Orden de Migración

1. ExecutiveView.tsx (1 gráfico) - Más simple, sirve como prueba
2. SalesView.tsx (3 gráficos) - Diferentes tipos de gráficos
3. PerformanceView.tsx (3 gráficos) - Similar a SalesView
4. PipelineView.tsx (6 gráficos) - Todos barras horizontales
5. RecoveryView.tsx (4 gráficos) - Similar a PipelineView
6. Eliminar dependencias y archivos de G2

## Checklist de Verificación

- [ ] Todos los gráficos se renderizan correctamente
- [ ] Colores consistentes con el tema (claro/oscuro)
- [ ] Tooltips funcionan y muestran información correcta
- [ ] Diseño responsive en móvil, tablet y desktop
- [ ] Leyendas visibles y legibles
- [ ] Ejes con títulos apropiados
- [ ] Animaciones suaves
- [ ] No hay errores en consola
