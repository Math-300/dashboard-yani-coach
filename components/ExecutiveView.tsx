import React, { useMemo } from 'react';
import { Users, UserPlus, DollarSign, TrendingUp, Clock, Wallet, BarChart3 } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import KPICard from './KPICard';
import { Contact, Sale } from '../types';
import {
    calculateTotalLeadsInPipeline,
    calculateNewLeadsToday,
    calculateMonthlySales,
    calculateConversionRate,
    calculateUrgentFollowUps,
    calculatePipelineValue,
    calculateFunnelByStatus,
    formatCurrency,
    FunnelStep
} from '../services/metricsCalculator';

interface ExecutiveViewProps {
    contacts: Contact[];
    allContacts: Contact[]; // 🚀 NUEVO: Todos los contactos para embudo y pipeline
    sales: Sale[];
    dateRange: { start: Date; end: Date };
    isDarkMode: boolean;
}

/**
 * Vista de Resumen Ejecutivo
 * 
 * Muestra KPIs principales y un gráfico de embudo de ventas
 * para dar una visión general del estado del pipeline.
 */
const ExecutiveView: React.FC<ExecutiveViewProps> = ({
    contacts,
    allContacts, // 🚀 NUEVO: Todos los contactos para embudo y pipeline
    sales,
    dateRange,
    isDarkMode
}) => {
    // Colores del tema para Recharts
    const axisColor = isDarkMode ? '#9ca3af' : '#4b5563';
    const gridColor = isDarkMode ? '#374151' : '#e5e7eb';
    const tooltipBg = isDarkMode ? '#1f2937' : '#ffffff';
    const tooltipBorder = isDarkMode ? '#374151' : '#e5e7eb';
    const tooltipText = isDarkMode ? '#f3f4f6' : '#1f2937';

    // Colores para cada estado del embudo
    const statusColors: Record<string, string> = {
        'Lead Nuevo': '#16a34a',           // Verde
        'En Seguimiento': '#2563eb',       // Azul
        'Interesado': '#d97706',           // Amber
        'Venta Cerrada': '#059669',        // Verde oscuro (éxito)
        'Venta Perdida': '#dc2626'         // Rojo
    };

    // Calcular todas las métricas
    // 🚀 FIX: Usar allContacts para embudo y pipeline (no filtrados por fecha)
    const metrics = useMemo(() => {
        // Leads en pipeline: usar todos los contactos (no filtrados)
        const totalLeadsInPipeline = calculateTotalLeadsInPipeline(allContacts);
        // Leads nuevos hoy: usar contactos filtrados por fecha
        const newLeadsToday = calculateNewLeadsToday(contacts, dateRange);
        // Ventas del mes: usar sales filtradas
        const monthlySales = calculateMonthlySales(sales, dateRange);
        // Tasa de conversión: calcular sobre todos los contactos
        const conversionRate = calculateConversionRate(allContacts, dateRange);
        // Seguimientos urgentes: usar todos los contactos
        const urgentFollowUps = calculateUrgentFollowUps(allContacts);
        // Valor del pipeline: usar todos los contactos
        const pipelineValue = calculatePipelineValue(allContacts);
        // Embudo: usar todos los contactos
        const funnelData = calculateFunnelByStatus(allContacts);

        return {
            totalLeadsInPipeline,
            newLeadsToday,
            monthlySales,
            conversionRate,
            urgentFollowUps,
            pipelineValue,
            funnelData
        };
    }, [contacts, allContacts, sales, dateRange]);

    // Preparar datos para el gráfico de embudo con mínimo visible
    const chartData = useMemo(() => {
        if (metrics.funnelData.length === 0) return [];

        const maxCount = Math.max(...metrics.funnelData.map(d => d.count), 1);
        const minVisible = maxCount * 0.05; // 5% del máximo para barras visibles

        return metrics.funnelData.map(d => ({
            ...d,
            // Usar el valor real para mostrar, pero un mínimo para el ancho de la barra
            displayCount: d.count === 0 ? minVisible : d.count
        }));
    }, [metrics.funnelData]);

    // Custom Tooltip para el gráfico
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload as FunnelStep;
            return (
                <div
                    className="px-3 py-2 rounded-lg shadow-lg border"
                    style={{
                        backgroundColor: tooltipBg,
                        borderColor: tooltipBorder,
                        color: tooltipText
                    }}
                >
                    <p className="font-semibold">{data.status}</p>
                    <p className="text-sm">
                        <span className="font-medium">{data.count}</span> contactos
                    </p>
                    <p className="text-sm opacity-80">
                        {data.percentage}% del total
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-8">
            {/* Header de la sección */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Resumen Ejecutivo
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Visión general del pipeline de ventas y métricas clave
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <BarChart3 className="w-4 h-4" />
                    <span>Actualizado en tiempo real</span>
                </div>
            </div>

            {/* Grid de KPIs - 3 columnas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* KPI 1: Total Leads en Pipeline */}
                <KPICard
                    title="Total Leads en Pipeline"
                    value={metrics.totalLeadsInPipeline}
                    icon={<Users className="w-6 h-6" />}
                    colorClass="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    tooltip="Contactos activos en el pipeline (nuevos, contactados e interesados). Excluye ventas cerradas ganadas y perdidas."
                />

                {/* KPI 2: Leads Nuevos Hoy */}
                <KPICard
                    title="Leads Nuevos Hoy"
                    value={metrics.newLeadsToday}
                    icon={<UserPlus className="w-6 h-6" />}
                    colorClass={
                        metrics.newLeadsToday > 0
                            ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }
                    subValue={metrics.newLeadsToday > 0 ? "¡Requiere atención!" : undefined}
                    tooltip="Leads con estado 'Nuevo' que fueron creados hoy. Si hay leads nuevos, requieren seguimiento inmediato."
                />

                {/* KPI 3: Ventas del Mes */}
                <KPICard
                    title="Ventas del Período"
                    value={metrics.monthlySales.count}
                    subValue={formatCurrency(metrics.monthlySales.totalAmount)}
                    icon={<DollarSign className="w-6 h-6" />}
                    colorClass="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    tooltip={`Cantidad de ventas cerradas en el período seleccionado y el monto total en COP.`}
                />

                {/* KPI 4: Tasa de Conversión */}
                <KPICard
                    title="Tasa de Conversión"
                    value={`${metrics.conversionRate}%`}
                    icon={<TrendingUp className="w-6 h-6" />}
                    colorClass={
                        metrics.conversionRate >= 50
                            ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                            : metrics.conversionRate >= 30
                                ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    }
                    trend={metrics.conversionRate >= 50 ? 'up' : metrics.conversionRate >= 30 ? 'neutral' : 'down'}
                    trendValue={`${metrics.conversionRate}% de efectividad`}
                    tooltip="Porcentaje de leads que se convirtieron en ventas cerradas. Fórmula: (Ganados / (Ganados + Perdidos)) × 100"
                />

                {/* KPI 5: Seguimientos Urgentes */}
                <KPICard
                    title="Seguimientos Urgentes"
                    value={metrics.urgentFollowUps}
                    icon={<Clock className="w-6 h-6" />}
                    colorClass={
                        metrics.urgentFollowUps > 0
                            ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }
                    subValue={metrics.urgentFollowUps > 0 ? "¡Acción requerida!" : "Al día"}
                    tooltip="Contactos con fecha de próximo contacto programada para hoy. Requieren seguimiento inmediato."
                />

                {/* KPI 6: Valor del Pipeline */}
                <KPICard
                    title="Valor del Pipeline"
                    value={formatCurrency(metrics.pipelineValue)}
                    icon={<Wallet className="w-6 h-6" />}
                    colorClass="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                    tooltip="Suma total de los valores estimados de todos los leads activos en el pipeline."
                />
            </div>

            {/* Gráfico de Embudo de Ventas */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Embudo de Ventas
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Distribución de contactos por estado en el pipeline
                        </p>
                    </div>
                </div>

                {/* Gráfico de embudo con Recharts */}
                <div className="w-full h-[400px]">
                    <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0} debounce={200}>
                        <BarChart
                            layout="vertical"
                            data={chartData}
                            margin={{ top: 20, right: 80, left: 40, bottom: 20 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                horizontal={false}
                                stroke={gridColor}
                            />
                            <XAxis
                                type="number"
                                tick={{ fill: axisColor, fontSize: 12 }}
                                axisLine={{ stroke: gridColor }}
                            >
                            </XAxis>
                            <YAxis
                                type="category"
                                dataKey="status"
                                width={120}
                                tick={{ fill: axisColor, fontSize: 12 }}
                                axisLine={{ stroke: gridColor }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar
                                dataKey="displayCount"
                                radius={[0, 6, 6, 0]}
                                label={{
                                    position: 'right',
                                    fill: axisColor,
                                    fontSize: 12,
                                    fontWeight: 500,
                                    formatter: (value: number, index: number) => {
                                        const data = chartData[index];
                                        return data ? `${data.count} (${data.percentage}%)` : '';
                                    }
                                }}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={statusColors[entry.status] || '#D4AF37'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Resumen del embudo */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                    {metrics.funnelData.map((step, index) => (
                        <div
                            key={step.status}
                            className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                        >
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {step.status}
                            </p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                                {step.count}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                {step.percentage}%
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Información adicional */}
            <div className="bg-gold-900/10 dark:bg-gold-900/20 border border-gold-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-gold-500/20">
                        <TrendingUp className="w-5 h-5 text-gold-500" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-gold-700 dark:text-gold-300">
                            Análisis Rápido
                        </h4>
                        <p className="text-sm text-gold-600/80 dark:text-gold-400/80 mt-1">
                            {metrics.conversionRate >= 50
                                ? `¡Excelente! Tu tasa de conversión del ${metrics.conversionRate}% está por encima del promedio de la industria (30-40%).`
                                : metrics.conversionRate >= 30
                                    ? `Tu tasa de conversión del ${metrics.conversionRate}% está en el rango promedio de la industria.`
                                    : `Tu tasa de conversión del ${metrics.conversionRate}% está por debajo del promedio. Considera revisar tu proceso de seguimiento.`
                            }
                            {metrics.urgentFollowUps > 0 && (
                                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                                    ⚠️ Tienes {metrics.urgentFollowUps} seguimiento(s) pendiente(s) para hoy.
                                </span>
                            )}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExecutiveView;
