# 📋 PLAN: Tooltips Informativos para Métricas

## 🎯 Objetivo
Agregar un icono de información minimalista a cada métrica que muestre una descripción al pasar el mouse, haciendo el dashboard comprensible para usuarios no técnicos.

---

## 📊 DEFINICIÓN DE TOOLTIPS POR MÉTRICA

### BusinessView - Salud Financiera

| Métrica | Tooltip |
|---------|---------|
| **Ingresos Totales** | "Suma de todas las ventas cerradas en el período seleccionado" |
| **Ticket Promedio** | "Monto promedio de cada venta. Se calcula: Ingresos Totales ÷ Número de Ventas" |
| **Tasa de Conversión** | "Porcentaje de leads que se convirtieron en clientes. Fórmula: Ganados ÷ (Ganados + Perdidos) × 100" |
| **Leads Nuevos** | "Contactos creados en el período seleccionado. Son potenciales clientes que aún no han comprado" |

### BusinessView - Eficiencia & Predicción (BI)

| Métrica | Tooltip |
|---------|---------|
| **Ciclo de Venta** | "Días promedio desde que un lead entra al sistema hasta que realiza su primera compra" |
| **Esfuerzo de Cierre** | "Número promedio de interacciones (llamadas, WhatsApp, emails) necesarias para cerrar una venta" |
| **Pipeline Ponderado** | "Proyección de ingresos probables basada en el valor estimado de cada lead y su probabilidad de cierre" |
| **Higiene de Leads** | "Leads activos con menos de 7 días de antigüedad. Indica qué tan 'frescos' son tus contactos" |

### TeamView - Ranking de Vendedoras

| Métrica | Tooltip |
|---------|---------|
| **Leads (Nuevos)** | "Leads asignados a esta vendedora durante el período seleccionado" |
| **Ciclo Venta** | "Días promedio que tarda esta vendedora en cerrar una venta desde el primer contacto" |
| **Antigüedad Activa** | "Promedio de días que llevan sus leads activos sin cerrar. Menor es mejor" |
| **Toques/Cierre** | "Interacciones promedio que necesita para cerrar una venta. Menor = más eficiente" |
| **Ventas** | "Total de ventas cerradas por esta vendedora en el período" |
| **% Cierre** | "Porcentaje de sus leads resueltos que se convirtieron en ventas" |
| **Facturación** | "Total de ingresos generados por esta vendedora" |

### RecoveryView - Recuperación

| Métrica | Tooltip |
|---------|---------|
| **Motivos de No Compra** | "Razones principales por las que los leads no compraron. Ayuda a identificar áreas de mejora" |
| **Top Países** | "Países con mayor cantidad de leads. Útil para decisiones de marketing" |
| **Dinero sobre la mesa** | "Intentos de compra fallidos que podrían recuperarse con seguimiento" |

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### 1. Modificar KPICard.tsx

```typescript
interface KPICardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  colorClass?: string;
  subValue?: string;
  tooltip?: string;  // NUEVO: Descripción de la métrica
}
```

### 2. Icono de Información
- Usar `Info` de Lucide React
- Tamaño pequeño (w-4 h-4)
- Color gris suave (text-gray-400)
- Opacidad baja por defecto, aumenta al hover

### 3. Comportamiento del Tooltip
- Mostrar al hacer hover sobre el icono
- Posición: arriba o abajo según espacio disponible
- Estilo: fondo oscuro, texto blanco, bordes redondeados
- Animación: fade in suave

---

## 📦 ARCHIVOS A MODIFICAR

| Archivo | Cambios |
|---------|---------|
| `components/KPICard.tsx` | Agregar prop `tooltip` y renderizar icono con tooltip |
| `components/BusinessView.tsx` | Pasar tooltips a cada KPICard |
| `components/TeamView.tsx` | Agregar tooltips en encabezados de tabla |
| `components/RecoveryView.tsx` | Agregar tooltips en títulos de secciones |

---

## ✅ DEFINITION OF DONE

- [ ] Cada métrica tiene un tooltip descriptivo
- [ ] Los tooltips usan lenguaje simple, sin tecnicismos
- [ ] El icono es minimalista y no distrae del valor principal
- [ ] El tooltip aparece suavemente al hover
- [ ] Funciona en dispositivos touch (tap para mostrar)
