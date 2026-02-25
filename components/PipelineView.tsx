import React, { useMemo } from 'react';
import { Users, XCircle, MessageSquare, Activity, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import KPICard from './KPICard';
import { Contact, Interaction } from '../types';
import {
    calculateLeadsByStatus,
    calculateLostReasons,
    calculateLeadsBySource,
    calculateLeadsByCountry,
    calculateInteractionsByChannel,
    calculateInteractionResults,
    calculateAvgInteractionsPerLead,
    calculateTotalLeadsInPipeline,
    calculateLostLeads,
    calculateTotalInteractions
} from '../services/metricsCalculator';

interface PipelineViewProps {
    contacts: Contact[];
    interactions: Interaction[];
    dateRange: { start: Date; end: Date };
    isDarkMode: boolean;
}

/**
 * Vista de Pipeline & Actividad
 * 
 * Muestra KPIs del pipeline, distribución de leads por estado,
 * análisis de motivos de venta perdida y gráficos de actividad.
 */
const PipelineView: React.FC<PipelineViewProps> = ({
    contacts,
    interactions,
    dateRange,
    isDarkMode
}) => {
    // Colores del tema para Recharts
    const axisColor = isDarkMode ? '#9ca3af' : '#4b5563';
    const gridColor = isDarkMode ? '#374151' : '#e5e7eb';
    const tooltipBg = isDarkMode ? '#1f2937' : '#ffffff';
    const tooltipBorder = isDarkMode ? '#374151' : '#e5e7eb';
    const tooltipText = isDarkMode ? '#f3f4f6' : '#1f2937';

    // Colores para gráficos
    const GOLD_COLORS = ['#D4AF37', '#B8860B', '#FFD700', '#FFA500', '#CD853F', '#DAA520', '#F0E68C'];
    const RESULT_COLORS = ['#D4AF37', '#22C55E', '#EF4444', '#3B82F6', '#8B5CF6', '#F59E0B'];

    // Calcular todas las métricas
    const metrics = useMemo(() => {
        const leadsInPipeline = calculateTotalLeadsInPipeline(contacts);
        const lostLeadsCount = calculateLostLeads(contacts);
        const totalInteractions = calculateTotalInteractions(interactions, dateRange);
        const avgInteractions = calculateAvgInteractionsPerLead(contacts, interactions);
        const leadsByStatus = calculateLeadsByStatus(contacts);
        const lostReasons = calculateLostReasons(contacts);
        const leadsBySource = calculateLeadsBySource(contacts);
        const leadsByCountry = calculateLeadsByCountry(contacts);
        const interactionsByChannel = calculateInteractionsByChannel(interactions);
        const interactionResults = calculateInteractionResults(interactions);

        return {
            leadsInPipeline,
            lostLeadsCount,
            totalInteractions,
            avgInteractions,
            leadsByStatus,
            lostReasons,
            leadsBySource,
            leadsByCountry,
            interactionsByChannel,
            interactionResults
        };
    }, [contacts, interactions, dateRange]);

    // Datos ordenados para gráficos
    const pipelineChartData = useMemo(() => {
        return [...metrics.leadsByStatus]
            .sort((a, b) => b.count - a.count)
            .map((item, idx) => ({
                ...item,
                isTop: idx === 0
            }));
    }, [metrics.leadsByStatus]);

    const countryChartData = useMemo(() => {
        return [...metrics.leadsByCountry]
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [metrics.leadsByCountry]);

    const lostReasonsChartData = useMemo(() => {
        return [...metrics.lostReasons]
            .sort((a, b) => a.count - b.count);
    }, [metrics.lostReasons]);

    // Custom Tooltip genérico
    const GenericTooltip = ({ active, payload, labelField = 'status', valueField = 'count' }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div
                    className="px-3 py-2 rounded-lg shadow-lg border"
                    style={{
                        backgroundColor: tooltipBg,
                        borderColor: tooltipBorder,
                        color: tooltipText
                    }}
                >
                    <p className="font-semibold">{data[labelField]}</p>
                    <p className="text-sm">Cantidad: <span className="font-medium">{data[valueField]}</span></p>
                    {data.percentage !== undefined && (
                        <p className="text-sm opacity-80">{data.percentage}% del total</p>
                    )}
                </div>
            );
        }
        return null;
    };

    // Función para obtener el icono de tendencia
    const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
        switch (trend) {
            case 'up':
                return <TrendingUp className="w-4 h-4 text-red-500" />;
            case 'down':
                return <TrendingDown className="w-4 h-4 text-green-500" />;
            default:
                return <Minus className="w-4 h-4 text-gray-400" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* KPIs Principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="Total Leads en Pipeline"
                    value={metrics.leadsInPipeline}
                    subValue="Contactos activos"
                    icon={<Users className="w-6 h-6" />}
                    colorClass="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    tooltip="Contactos activos excluyendo Ganados y Perdidos"
                />
                <KPICard
                    title="Leads Perdidos"
                    value={metrics.lostLeadsCount}
                    subValue="Total con Estado = Perdido"
                    icon={<XCircle className="w-6 h-6" />}
                    colorClass="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    tooltip="Total de contactos con estado 'Venta Perdida'"
                />
                <KPICard
                    title="Total Interacciones del Mes"
                    value={metrics.totalInteractions}
                    subValue="En el período seleccionado"
                    icon={<MessageSquare className="w-6 h-6" />}
                    colorClass="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    tooltip="Conteo de interacciones en el rango de fechas"
                />
                <KPICard
                    title="Promedio Interacciones por Lead"
                    value={metrics.avgInteractions}
                    subValue="Interacciones / Leads activos"
                    icon={<Activity className="w-6 h-6" />}
                    colorClass="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                    tooltip="Total interacciones dividido entre leads activos"
                />
            </div>

            {/* Sección de Estados del Pipeline (Embudo Visual) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-gold-500" />
                    Distribución de Leads por Estado
                </h3>

                {/* Barras de estado visual */}
                <div className="grid grid-cols-1 md:grid-cols-7 gap-2 mb-6">
                    {metrics.leadsByStatus.map((item, index) => {
                        const colors = [
                            'bg-blue-500',
                            'bg-yellow-500',
                            'bg-green-500',
                            'bg-purple-500',
                            'bg-orange-500',
                            'bg-emerald-500',
                            'bg-red-500'
                        ];
                        return (
                            <div key={item.status} className="text-center">
                                <div
                                    className={`${colors[index % colors.length]} rounded-t-lg transition-all duration-300`}
                                    style={{ height: `${Math.max(20, item.percentage * 2)}px` }}
                                />
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-2">{item.status}</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">{item.count}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{item.percentage}%</p>
                            </div>
                        );
                    })}
                </div>

                {/* Gráfico de Pipeline con Recharts */}
                <div className="w-full h-[300px]">
                    <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0} debounce={200}>
                        <BarChart
                            layout="vertical"
                            data={pipelineChartData}
                            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                            <XAxis
                                type="number"
                                tick={{ fill: axisColor, fontSize: 11 }}
                                axisLine={{ stroke: gridColor }}
                            />
                            <YAxis
                                type="category"
                                dataKey="status"
                                tick={{ fill: axisColor, fontSize: 11 }}
                                axisLine={{ stroke: gridColor }}
                                width={95}
                            />
                            <Tooltip content={<GenericTooltip labelField="status" valueField="count" />} />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                {pipelineChartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.isTop ? '#D4AF37' : '#6B7280'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Sección PRIORITARIA: Motivos de Venta Perdida */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-amber-500 dark:border-gold-500 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-6 h-6 text-amber-500 dark:text-gold-400" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        Análisis de Motivos de Venta Perdida
                    </h3>
                    <span className="ml-2 px-2 py-1 text-xs font-semibold bg-amber-100 dark:bg-gold-900/30 text-amber-700 dark:text-gold-300 rounded-full">
                        PRIORITARIO
                    </span>
                </div>

                {metrics.lostReasons.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <XCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No hay datos de ventas perdidas para analizar</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Tabla de Análisis de Pérdidas */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                                Desglose de Motivos
                            </h4>
                            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-900">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                                Motivo
                                            </th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                                Cantidad
                                            </th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                                % del Total
                                            </th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                                Tendencia
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {metrics.lostReasons.map((item, index) => (
                                            <tr key={item.reason} className={index === 0 ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                                    {item.reason}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-center font-bold text-gray-900 dark:text-white">
                                                    {item.count}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                                                    {item.percentage}%
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {getTrendIcon(item.trend)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Gráfico de Motivos con Recharts */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                                Visualización
                            </h4>
                            <div className="w-full h-[250px]">
                                <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0} debounce={200}>
                                    <BarChart
                                        layout="vertical"
                                        data={lostReasonsChartData}
                                        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                                        <XAxis
                                            type="number"
                                            tick={{ fill: axisColor, fontSize: 11 }}
                                            axisLine={{ stroke: gridColor }}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="reason"
                                            tick={{ fill: axisColor, fontSize: 10 }}
                                            axisLine={{ stroke: gridColor }}
                                            width={75}
                                        />
                                        <Tooltip content={<GenericTooltip labelField="reason" valueField="count" />} />
                                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                            {lostReasonsChartData.map((entry, index) => {
                                                // Gradiente de dorado a rojo
                                                const maxCount = Math.max(...lostReasonsChartData.map(d => d.count));
                                                const ratio = maxCount > 0 ? entry.count / maxCount : 0;
                                                const color = ratio > 0.7 ? '#DC2626' : ratio > 0.4 ? '#B8860B' : '#D4AF37';
                                                return <Cell key={`cell-${index}`} fill={color} />;
                                            })}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Grid de Gráficos (2 columnas) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Origen de Leads - Pie Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Origen de Leads
                    </h3>
                    <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0} debounce={200}>
                            <PieChart>
                                <Pie
                                    data={metrics.leadsBySource}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="count"
                                    label={({ source, percentage }) => `${source}: ${percentage}%`}
                                    labelLine={{ stroke: axisColor }}
                                >
                                    {metrics.leadsBySource.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={GOLD_COLORS[index % GOLD_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<GenericTooltip labelField="source" valueField="count" />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Leads por País - Bar Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Leads por País
                    </h3>
                    <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0} debounce={200}>
                            <BarChart data={countryChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                                <XAxis
                                    dataKey="country"
                                    tick={{ fill: axisColor, fontSize: 10 }}
                                    axisLine={{ stroke: gridColor }}
                                />
                                <YAxis
                                    tick={{ fill: axisColor, fontSize: 11 }}
                                    axisLine={{ stroke: gridColor }}
                                />
                                <Tooltip content={<GenericTooltip labelField="country" valueField="count" />} />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {countryChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={GOLD_COLORS[index % GOLD_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Interacciones por Canal - Bar Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Interacciones por Canal
                    </h3>
                    <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0} debounce={200}>
                            <BarChart data={metrics.interactionsByChannel} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                                <XAxis
                                    dataKey="channel"
                                    tick={{ fill: axisColor, fontSize: 10 }}
                                    axisLine={{ stroke: gridColor }}
                                />
                                <YAxis
                                    tick={{ fill: axisColor, fontSize: 11 }}
                                    axisLine={{ stroke: gridColor }}
                                />
                                <Tooltip content={<GenericTooltip labelField="channel" valueField="count" />} />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {metrics.interactionsByChannel.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={GOLD_COLORS[index % GOLD_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Resultado de Interacciones - Pie Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Resultado de Interacciones
                    </h3>
                    <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={metrics.interactionResults}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="count"
                                    label={({ result, percentage }) => `${result}: ${percentage}%`}
                                    labelLine={{ stroke: axisColor }}
                                >
                                    {metrics.interactionResults.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={RESULT_COLORS[index % RESULT_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<GenericTooltip labelField="result" valueField="count" />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PipelineView;
