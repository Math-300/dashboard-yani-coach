import React, { useMemo } from 'react';
import { Users, UserPlus, DollarSign, TrendingUp, Clock, Wallet, BarChart3 } from 'lucide-react';
import KPICard from './KPICard';
import EmbudoRespondio from './EmbudoRespondio';
import { Contact, Sale, KpiCounts } from '../types';
import { FunnelCounts, FunnelRespondioRow, ResponsividadVendedoraRow } from '../services/types';
import {
    calculateTotalLeadsInPipeline,
    calculateNewLeadsToday,
    calculateMonthlySales,
    calculateConversionRate,
    calculateUrgentFollowUps,
    calculatePipelineValue,
    formatCurrency,
} from '../services/metricsCalculator';

interface ExecutiveViewProps {
    contacts: Contact[];
    funnelCounts: FunnelCounts;
    kpiCounts: KpiCounts;
    sales: Sale[];
    dateRange: { start: Date; end: Date };
    isDarkMode: boolean;
    funnelRespondio: FunnelRespondioRow;
    responsividad: ResponsividadVendedoraRow[];
}

/**
 * Vista de Resumen Ejecutivo
 * 
 * Muestra KPIs principales y un gráfico de embudo de ventas
 * para dar una visión general del estado del pipeline.
 */
const ExecutiveView: React.FC<ExecutiveViewProps> = ({
    contacts,
    funnelCounts,
    kpiCounts,
    sales,
    dateRange,
    isDarkMode,
    funnelRespondio,
    responsividad
}) => {
    // Calcular métricas
    const metrics = useMemo(() => {
        // Leads en pipeline: calcular desde conteos del embudo
        const totalLeadsInPipeline = calculateTotalLeadsInPipeline(funnelCounts);
        // Leads nuevos: conteo pre-calculado
        const newLeadsToday = calculateNewLeadsToday(kpiCounts.newLeads);
        // Ventas del período (monto) con datos filtrados
        const monthlySales = calculateMonthlySales(sales, dateRange);
        // Tasa de conversión: ventas / leads creados
        const conversionRate = calculateConversionRate(kpiCounts.leadsCreated, kpiCounts.salesCount);
        // Seguimientos urgentes: conteo pre-calculado
        const urgentFollowUps = calculateUrgentFollowUps(kpiCounts.urgentFollowUps);
        // Valor del pipeline
        const pipelineValue = calculatePipelineValue(contacts);

        return {
            totalLeadsInPipeline,
            newLeadsToday,
            monthlySales,
            conversionRate,
            urgentFollowUps,
            pipelineValue,
        };
    }, [contacts, funnelCounts, kpiCounts, sales, dateRange]);

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
                    value={metrics.conversionRate === null ? '—' : `${metrics.conversionRate}%`}
                    icon={<TrendingUp className="w-6 h-6" />}
                    colorClass={
                        metrics.conversionRate === null
                            ? "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            : metrics.conversionRate >= 50
                                ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                : metrics.conversionRate >= 30
                                    ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                                    : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    }
                    trend={
                        metrics.conversionRate === null
                            ? 'neutral'
                            : metrics.conversionRate >= 50 ? 'up' : metrics.conversionRate >= 30 ? 'neutral' : 'down'
                    }
                    trendValue={
                        metrics.conversionRate === null
                            ? 'Sin leads en el período'
                            : `${metrics.conversionRate}% de efectividad`
                    }
                    tooltip="Porcentaje de leads creados en el período que se convirtieron en venta. Si no hay leads creados en el período, se muestra — (no es calculable)."
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

            {/* Embudo real + Responsividad del equipo */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <EmbudoRespondio funnel={funnelRespondio} />
                </div>
                <div className="bg-gray-800 rounded-xl p-6 border border-white/10">
                    <h3 className="text-lg font-semibold text-gray-100 mb-1">Responsividad del equipo</h3>
                    <p className="text-sm text-gray-400 mb-4">Mediana de primera respuesta</p>
                    <ul className="space-y-3">
                        {responsividad.slice(0, 6).map((v) => (
                            <li key={v.vendedora_id} className="flex items-center justify-between">
                                <span className="text-sm text-gray-300">{v.vendedora_nombre ?? 'Sin nombre'}</span>
                                <span className="text-sm text-gray-100">
                                    <span className="font-semibold">{v.chats_respondidos}</span>
                                    <span className="text-gray-500"> chats · </span>
                                    <span className="text-gold-400">{v.resp_mediana_min !== null ? `${v.resp_mediana_min} min` : '—'}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
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
                            {metrics.conversionRate === null
                                ? `No hay leads creados en el período seleccionado, así que no se puede calcular tasa de conversión.`
                                : metrics.conversionRate >= 50
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
