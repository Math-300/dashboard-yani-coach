import React, { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    Line,
    ComposedChart,
    Legend,
    ReferenceLine
} from 'recharts';
import { TrendingUp, BarChart2, Award, MessageCircle, AlertCircle, Clock, CheckCircle, Users } from 'lucide-react';
import KPICard from './KPICard';
import { Contact, Interaction, Sale, Seller } from '../types';
import {
    calculateSalesByVendor,
    calculateInteractionsByVendor,
    calculatePendingFollowUpsByVendor,
    formatCurrency
} from '../services/metricsCalculator';

interface PerformanceViewProps {
    contacts: Contact[];
    interactions: Interaction[];
    sales: Sale[];
    sellers: Seller[];
    dateRange: { start: Date; end: Date };
    isDarkMode: boolean;
}

/**
 * Vista de Desempeño de Vendedoras
 * 
 * Muestra KPIs del equipo, ranking de vendedoras, gráficos de ventas
 * y seguimientos pendientes.
 */
const PerformanceView: React.FC<PerformanceViewProps> = ({
    contacts,
    interactions,
    sales,
    sellers,
    dateRange,
    isDarkMode
}) => {
    // Colores del tema
    const axisColor = isDarkMode ? '#9ca3af' : '#4b5563';
    const gridColor = isDarkMode ? '#374151' : '#e5e7eb';
    const tooltipBg = isDarkMode ? '#1f2937' : '#ffffff';
    const tooltipBorder = isDarkMode ? '#374151' : '#e5e7eb';
    const tooltipText = isDarkMode ? '#f3f4f6' : '#1f2937';

    // Calcular todas las métricas
    const metrics = useMemo(() => {
        const vendorPerformance = calculateSalesByVendor(sales, contacts, interactions, sellers);
        const vendorInteractions = calculateInteractionsByVendor(interactions, sellers);
        const vendorFollowUps = calculatePendingFollowUpsByVendor(contacts, sellers);

        // KPIs del equipo
        const totalTeamSales = vendorPerformance.reduce((sum, v) => sum + v.salesAmount, 0);
        const activeVendors = vendorPerformance.filter(v => v.salesCount > 0 || v.activeLeads > 0).length;
        const avgSalesPerVendor = activeVendors > 0 ? Math.round(totalTeamSales / activeVendors) : 0;
        const bestVendor = vendorPerformance.length > 0 ? vendorPerformance[0] : null;
        const totalInteractions = vendorInteractions.reduce((sum, v) => sum + v.total, 0);

        return {
            vendorPerformance,
            vendorInteractions,
            vendorFollowUps,
            totalTeamSales,
            activeVendors,
            avgSalesPerVendor,
            bestVendor,
            totalInteractions
        };
    }, [contacts, interactions, sales, sellers]);

    const salesChartData = useMemo(() => {
        return [...metrics.vendorPerformance]
            .sort((a, b) => a.salesAmount - b.salesAmount)
            .map((v, idx, arr) => ({
                vendorName: v.vendorName,
                salesAmount: v.salesAmount,
                isTop: idx === arr.length - 1
            }));
    }, [metrics.vendorPerformance]);

    const interactionsChartData = useMemo(() => {
        return metrics.vendorInteractions.map(v => ({
            vendorName: v.vendorName,
            whatsapp: v.byType.whatsapp,
            email: v.byType.email,
            call: v.byType.call,
            meeting: v.byType.meeting
        }));
    }, [metrics.vendorInteractions]);

    const avgConversion = useMemo(() => {
        if (metrics.vendorPerformance.length === 0) return 0;
        return metrics.vendorPerformance.reduce((sum, v) => sum + v.conversionRate, 0) / metrics.vendorPerformance.length;
    }, [metrics.vendorPerformance]);

    const VendorTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div
                    className="px-3 py-2 rounded-lg shadow-lg border"
                    style={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }}
                >
                    <p className="font-semibold">{data.vendorName}</p>
                    <p className="text-sm">Ventas: <span className="font-medium">{formatCurrency(data.salesAmount)}</span></p>
                </div>
            );
        }
        return null;
    };

    const ConversionTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div
                    className="px-3 py-2 rounded-lg shadow-lg border"
                    style={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }}
                >
                    <p className="font-semibold">{data.vendorName}</p>
                    <p className="text-sm">Conversión: <span className="font-medium">{data.conversionRate}%</span></p>
                </div>
            );
        }
        return null;
    };

    // Función para obtener el badge de posición
    const getPositionBadge = (rank: number) => {
        switch (rank) {
            case 1:
                return <span className="text-2xl">🥇</span>;
            case 2:
                return <span className="text-2xl">🥈</span>;
            case 3:
                return <span className="text-2xl">🥉</span>;
            default:
                return <span className="text-lg font-bold text-gray-400">#{rank}</span>;
        }
    };

    return (
        <div className="space-y-6">
            {/* KPIs del Equipo */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="Total Ventas del Equipo"
                    value={formatCurrency(metrics.totalTeamSales)}
                    icon={<TrendingUp className="w-6 h-6" />}
                    subValue={`${metrics.vendorPerformance.reduce((sum, v) => sum + v.salesCount, 0)} ventas totales`}
                    colorClass="bg-gold-50 text-gold-600 dark:bg-gold-900/30 dark:text-gold-400"
                    tooltip="Suma total de los montos de todas las ventas cerradas por el equipo en el período"
                />
                <KPICard
                    title="Promedio por Vendedora"
                    value={formatCurrency(metrics.avgSalesPerVendor)}
                    icon={<BarChart2 className="w-6 h-6" />}
                    subValue={`${metrics.activeVendors} vendedoras activas`}
                    colorClass="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    tooltip="Ingresos promedio generados por cada vendedora activa (con ventas o leads)"
                />
                <KPICard
                    title="Mejor Vendedora"
                    value={metrics.bestVendor?.vendorName || 'Sin datos'}
                    icon={<Award className="w-6 h-6" />}
                    subValue={metrics.bestVendor ? formatCurrency(metrics.bestVendor.salesAmount) : '-'}
                    colorClass="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    tooltip="Vendedora con mayor monto de ventas en el período seleccionado"
                />
                <KPICard
                    title="Total Interacciones"
                    value={metrics.totalInteractions.toLocaleString('es-CO')}
                    icon={<MessageCircle className="w-6 h-6" />}
                    subValue="Del equipo completo"
                    colorClass="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                    tooltip="Suma de todas las interacciones (WhatsApp, emails, llamadas, reuniones) del equipo"
                />
            </div>

            {/* Tabla de Ranking de Vendedoras */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gold-500/10 to-transparent">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-gold-500" />
                        Ranking de Vendedoras
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pos.</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vendedora</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ventas #</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ventas $</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tasa Conv.</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Días Prom.</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Leads Activos</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Interacciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {metrics.vendorPerformance.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                        No hay datos de vendedoras disponibles
                                    </td>
                                </tr>
                            ) : (
                                metrics.vendorPerformance.map((vendor) => (
                                    <tr
                                        key={vendor.vendorId}
                                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${vendor.rank === 1 ? 'bg-gold-500/5' : ''
                                            }`}
                                    >
                                        <td className="px-4 py-4 text-center">
                                            {getPositionBadge(vendor.rank || 0)}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm ${vendor.rank === 1 ? 'bg-gold-500' : 'bg-gray-400'
                                                    }`}>
                                                    {vendor.vendorName.charAt(0).toUpperCase()}
                                                </div>
                                                <span className={`ml-3 font-medium ${vendor.rank === 1 ? 'text-gold-600 dark:text-gold-400' : 'text-gray-900 dark:text-white'
                                                    }`}>
                                                    {vendor.vendorName}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="font-semibold text-gray-900 dark:text-white">{vendor.salesCount}</span>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <span className="font-semibold text-gold-600 dark:text-gold-400">{formatCurrency(vendor.salesAmount)}</span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${vendor.conversionRate >= 50
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : vendor.conversionRate >= 25
                                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                }`}>
                                                {vendor.conversionRate}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center text-gray-600 dark:text-gray-300">
                                            {vendor.avgClosingDays > 0 ? `${vendor.avgClosingDays} días` : '-'}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                                {vendor.activeLeads}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center text-gray-600 dark:text-gray-300">
                                            {vendor.interactions}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico de Ventas por Vendedora */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-gold-500" />
                        Ventas por Vendedora
                    </h3>
                    <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0} debounce={200}>
                            <BarChart layout="vertical" data={salesChartData} margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                                <XAxis
                                    type="number"
                                    tick={{ fill: axisColor, fontSize: 11 }}
                                    axisLine={{ stroke: gridColor }}
                                    tickFormatter={(v) => formatCurrency(v)}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="vendorName"
                                    tick={{ fill: axisColor, fontSize: 11 }}
                                    axisLine={{ stroke: gridColor }}
                                    width={75}
                                />
                                <Tooltip content={<VendorTooltip />} />
                                <Bar dataKey="salesAmount" radius={[0, 4, 4, 0]}>
                                    {salesChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.isTop ? '#D4AF37' : '#6B7280'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Gráfico de Interacciones por Tipo */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-gold-500" />
                        Interacciones por Tipo y Vendedora
                    </h3>
                    <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0} debounce={200}>
                            <BarChart data={interactionsChartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                                <XAxis dataKey="vendorName" tick={{ fill: axisColor, fontSize: 10 }} axisLine={{ stroke: gridColor }} />
                                <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="whatsapp" name="WhatsApp" fill="#25D366" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="email" name="Email" fill="#EA4335" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="call" name="Llamada" fill="#4285F4" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="meeting" name="Reunión" fill="#9333EA" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Gráfico de Tasa de Conversión */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-gold-500" />
                    Tasa de Conversión por Vendedora
                </h3>
                <div className="w-full h-[300px]">
                    <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0} debounce={200}>
                        <ComposedChart data={metrics.vendorPerformance} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                            <XAxis dataKey="vendorName" tick={{ fill: axisColor, fontSize: 10 }} axisLine={{ stroke: gridColor }} />
                            <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                            <Tooltip content={<ConversionTooltip />} />
                            <Bar dataKey="conversionRate" radius={[4, 4, 0, 0]} fill="#D4AF37" />
                            <ReferenceLine y={avgConversion} stroke="#D4AF37" strokeDasharray="5 5" strokeWidth={2} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Sección de Seguimientos Pendientes */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-500/10 to-transparent">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        Seguimientos Pendientes por Vendedora
                    </h2>
                </div>
                <div className="p-6">
                    {metrics.vendorFollowUps.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                            No hay datos de seguimientos disponibles
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {metrics.vendorFollowUps.map((followUp) => (
                                <div
                                    key={followUp.vendorId}
                                    className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-semibold text-gray-900 dark:text-white">
                                            {followUp.vendorName}
                                        </h4>
                                        <span className={`text-sm font-bold ${followUp.total > 10
                                            ? 'text-red-500'
                                            : followUp.total > 5
                                                ? 'text-yellow-500'
                                                : 'text-green-500'
                                            }`}>
                                            {followUp.total} total
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {/* Vencidos */}
                                        {followUp.overdue > 0 && (
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                                    <span className="text-red-600 dark:text-red-400">Vencidos</span>
                                                </div>
                                                <span className="font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">
                                                    {followUp.overdue}
                                                </span>
                                            </div>
                                        )}
                                        {/* Hoy */}
                                        {followUp.today > 0 && (
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-yellow-500" />
                                                    <span className="text-yellow-600 dark:text-yellow-400">Para hoy</span>
                                                </div>
                                                <span className="font-semibold text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded">
                                                    {followUp.today}
                                                </span>
                                            </div>
                                        )}
                                        {/* Próximos */}
                                        {followUp.upcoming > 0 && (
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                                    <span className="text-green-600 dark:text-green-400">Próximos</span>
                                                </div>
                                                <span className="font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded">
                                                    {followUp.upcoming}
                                                </span>
                                            </div>
                                        )}
                                        {/* Sin pendientes */}
                                        {followUp.total === 0 && (
                                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                <CheckCircle className="w-4 h-4" />
                                                <span>Sin seguimientos pendientes</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PerformanceView;
