import React, { useMemo } from 'react';
import {
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import {
    ShoppingCart,
    XCircle,
    RefreshCw,
    DollarSign,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Minus,
    User,
    Clock
} from 'lucide-react';
import KPICard from './KPICard';
import { Contact, PurchaseAttempt, Seller, PurchaseAttemptStatus } from '../types';
import {
    calculatePurchaseAttemptsByStatus,
    calculateRecoveryMetrics,
    calculateRecoveryByVendor,
    calculateAttemptTrends,
    calculateFailedAttempts,
    calculateRecoveredValue,
    formatCurrency,
    formatNumber
} from '../services/metricsCalculator';

interface RecoveryViewProps {
    contacts: Contact[];
    attempts: PurchaseAttempt[];
    sellers: Seller[];
    isDarkMode: boolean;
}

const RecoveryView: React.FC<RecoveryViewProps> = ({
    contacts,
    attempts,
    sellers,
    isDarkMode
}) => {
    // Colores del tema
    const axisColor = isDarkMode ? '#9ca3af' : '#4b5563';
    const gridColor = isDarkMode ? '#374151' : '#e5e7eb';
    const tooltipBg = isDarkMode ? '#1f2937' : '#ffffff';
    const tooltipBorder = isDarkMode ? '#374151' : '#e5e7eb';
    const tooltipText = isDarkMode ? '#f3f4f6' : '#1f2937';

    // Colores por estado
    const statusColors: Record<string, string> = {
        Exitoso: '#22C55E',
        Fallido: '#EF4444',
        Abandonado: '#F59E0B'
    };

    // Calcular métricas
    const totalAttempts = attempts.length;
    const failedAttempts = calculateFailedAttempts(attempts);
    const recoveryMetrics = calculateRecoveryMetrics(attempts, contacts);
    const recoveredValue = calculateRecoveredValue(attempts);

    const attemptsByStatus = calculatePurchaseAttemptsByStatus(attempts);
    const recoveryByVendor = calculateRecoveryByVendor(attempts, sellers);
    const attemptTrends = calculateAttemptTrends(attempts, 'week');

    const trendChartData = useMemo(() => {
        return attemptTrends.map((trend) => ({
            period: trend.period,
            successful: trend.successful,
            failed: trend.failed,
            abandoned: trend.abandoned
        }));
    }, [attemptTrends]);

    // Función para mostrar tendencia
    const renderTrend = (trend: 'up' | 'down' | 'stable') => {
        switch (trend) {
            case 'up':
                return <TrendingUp className="w-4 h-4 text-green-500" />;
            case 'down':
                return <TrendingDown className="w-4 h-4 text-red-500" />;
            default:
                return <Minus className="w-4 h-4 text-gray-400" />;
        }
    };

    // Obtener nombre de vendedora por ID
    const getSellerName = (sellerId: string | undefined): string => {
        if (!sellerId) return 'Sin asignar';
        const seller = sellers.find((s) => s.id === sellerId);
        return seller?.name || 'Desconocido';
    };

    // Calcular días en seguimiento
    const getDaysInFollowUp = (attempt: PurchaseAttempt): number => {
        if (!attempt.recoverySellerId) return 0;
        const attemptDate = new Date(attempt.date);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - attemptDate.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Intentos recuperables para la tabla
    const recoverableAttempts = attempts
        .filter((a) => a.status === PurchaseAttemptStatus.FAILED || a.status === PurchaseAttemptStatus.ABANDONED)
        .slice(0, 10);

    // Tooltips personalizados
    const StatusTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div
                    className="px-3 py-2 rounded-lg shadow-lg border"
                    style={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }}
                >
                    <p className="font-semibold">{data.status}</p>
                    <p className="text-sm">Cantidad: <span className="font-medium">{data.count}</span></p>
                    <p className="text-sm">Valor: <span className="font-medium">{formatCurrency(data.totalValue)}</span></p>
                    <p className="text-sm opacity-80">{data.percentage}% del total</p>
                </div>
            );
        }
        return null;
    };

    const TrendTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div
                    className="px-3 py-2 rounded-lg shadow-lg border"
                    style={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }}
                >
                    <p className="font-semibold">{label}</p>
                    {payload.map((entry: any) => (
                        <p key={entry.dataKey} className="text-sm">
                            <span className="font-medium">{entry.dataKey}: </span>{entry.value}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    const VendorTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div
                    className="px-3 py-2 rounded-lg shadow-lg border"
                    style={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }}
                >
                    <p className="font-semibold">{data.vendorName}</p>
                    <p className="text-sm">Recuperación: <span className="font-medium">{data.recoveryRate}%</span></p>
                    <p className="text-sm">Recuperados: <span className="font-medium">{data.recoveredAttempts}</span></p>
                    <p className="text-sm opacity-80">Asignados: {data.assignedAttempts}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            {/* KPIs Principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="Total Intentos de Compra"
                    value={formatNumber(totalAttempts)}
                    subValue="En el período"
                    icon={<ShoppingCart className="w-6 h-6" />}
                    colorClass="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    tooltip="Conteo total de intentos de compra registrados"
                />
                <KPICard
                    title="Intentos Fallidos"
                    value={formatNumber(failedAttempts)}
                    subValue="Fallidos + Abandonados"
                    icon={<XCircle className="w-6 h-6" />}
                    colorClass="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    trend={failedAttempts > 0 ? 'up' : 'neutral'}
                    trendValue={failedAttempts > 0 ? `${failedAttempts} intentos` : 'Sin fallidos'}
                    tooltip="Total de intentos con estado Fallido o Abandonado"
                />
                <KPICard
                    title="Tasa de Recuperación"
                    value={`${recoveryMetrics.recoveryRate}%`}
                    subValue="Intentos recuperados"
                    icon={<RefreshCw className="w-6 h-6" />}
                    colorClass="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                    trend={recoveryMetrics.recoveryRate >= 50 ? 'up' : recoveryMetrics.recoveryRate >= 25 ? 'neutral' : 'down'}
                    trendValue={`${recoveryMetrics.recovered} de ${recoveryMetrics.totalRecoverable}`}
                    tooltip="Porcentaje de intentos recuperados del total recuperable"
                />
                <KPICard
                    title="Valor Recuperado"
                    value={formatCurrency(recoveredValue)}
                    subValue={`de ${formatCurrency(recoveryMetrics.potentialValue)} potencial`}
                    icon={<DollarSign className="w-6 h-6" />}
                    colorClass="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    tooltip="Valor total de intentos recuperados exitosamente"
                />
            </div>

            {/* Sección PRIORITARIA: Recuperación */}
            {recoveryMetrics.totalRecoverable > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-amber-200 dark:border-amber-900/50 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 px-6 py-4 border-b border-amber-200 dark:border-amber-900/50">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                            <div>
                                <h3 className="text-lg font-bold text-amber-700 dark:text-amber-300">
                                    Seguimiento de Recuperación
                                </h3>
                                <p className="text-sm text-amber-600/70 dark:text-amber-400/70">
                                    Métrica Prioritaria - Gestión de intentos fallidos y abandonados
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        {/* Métricas de Recuperación */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Total Recuperables</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{recoveryMetrics.totalRecoverable}</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Recuperados</p>
                                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{recoveryMetrics.recovered}</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Valor Potencial</p>
                                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(recoveryMetrics.potentialValue)}</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Valor Recuperado</p>
                                <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(recoveryMetrics.recoveredValue)}</p>
                            </div>
                        </div>

                        {/* Tabla de Seguimiento */}
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                            Intentos en Seguimiento
                        </h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">ID</th>
                                        <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Cliente</th>
                                        <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Monto</th>
                                        <th className="text-center py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Estado</th>
                                        <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Vendedora</th>
                                        <th className="text-center py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Días</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recoverableAttempts.map((attempt, index) => (
                                        <tr
                                            key={attempt.id || index}
                                            className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                                        >
                                            <td className="py-2 px-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                                                #{attempt.id?.slice(0, 8) || index + 1}
                                            </td>
                                            <td className="py-2 px-3 text-gray-800 dark:text-gray-200">
                                                {contacts.find((c) => c.id === attempt.contactId)?.name || 'Desconocido'}
                                            </td>
                                            <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-white">
                                                {formatCurrency(attempt.amount || 0)}
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                                <span
                                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${attempt.status === PurchaseAttemptStatus.FAILED
                                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                        }`}
                                                >
                                                    {attempt.status}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-gray-400" />
                                                    <span className="text-gray-700 dark:text-gray-300">
                                                        {getSellerName(attempt.recoverySellerId)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Clock className="w-4 h-4 text-gray-400" />
                                                    <span
                                                        className={`font-medium ${getDaysInFollowUp(attempt) > 7
                                                            ? 'text-red-600 dark:text-red-400'
                                                            : 'text-gray-600 dark:text-gray-400'
                                                            }`}
                                                    >
                                                        {getDaysInFollowUp(attempt)}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {recoverableAttempts.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-gray-400 dark:text-gray-500">
                                                No hay intentos recuperables en este momento
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabla de Intentos por Estado */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                    Análisis de Intentos de Compra
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Estado</th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Cantidad</th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">% del Total</th>
                                <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Valor Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attemptsByStatus.map((item, index) => (
                                <tr
                                    key={index}
                                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                                >
                                    <td className="py-2 px-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColors[item.status] || '#6B7280' }} />
                                            <span className="text-gray-800 dark:text-gray-200">{item.status}</span>
                                        </div>
                                    </td>
                                    <td className="py-2 px-3 text-center font-semibold text-gray-900 dark:text-white">{item.count}</td>
                                    <td className="py-2 px-3 text-center text-gray-600 dark:text-gray-400">{item.percentage}%</td>
                                    <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-white">
                                        {formatCurrency(item.totalValue)}
                                    </td>
                                </tr>
                            ))}
                            {attemptsByStatus.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-gray-400 dark:text-gray-500">
                                        No hay datos de intentos de compra
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Distribución de Intentos por Estado */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                        Distribución de Intentos por Estado
                    </h3>
                    {attemptsByStatus.length > 0 ? (
                        <div className="w-full h-[280px]">
                            <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0} debounce={200}>
                                <PieChart>
                                    <Pie
                                        data={attemptsByStatus}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={100}
                                        dataKey="count"
                                        label={({ status, percentage }) => `${status}: ${percentage}%`}
                                        labelLine={{ stroke: axisColor }}
                                    >
                                        {attemptsByStatus.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={statusColors[entry.status] || '#6B7280'} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<StatusTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500">
                            Sin datos de intentos
                        </div>
                    )}
                </div>

                {/* Tendencia de Intentos */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                        Tendencia de Intentos
                    </h3>
                    {trendChartData.length > 0 ? (
                        <div className="w-full h-[280px]">
                            <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0} debounce={200}>
                                <LineChart data={trendChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                    <XAxis dataKey="period" tick={{ fill: axisColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} />
                                    <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} />
                                    <Tooltip content={<TrendTooltip />} />
                                    <Line type="monotone" dataKey="successful" stroke={statusColors.Exitoso} strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="failed" stroke={statusColors.Fallido} strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="abandoned" stroke={statusColors.Abandonado} strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500">
                            Sin datos de tendencia
                        </div>
                    )}
                </div>

                {/* Valor por Estado */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                        Valor por Estado
                    </h3>
                    {attemptsByStatus.length > 0 ? (
                        <div className="w-full h-[280px]">
                            <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0} debounce={200}>
                                <BarChart data={attemptsByStatus} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                                    <XAxis dataKey="status" tick={{ fill: axisColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} />
                                    <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip content={<StatusTooltip />} />
                                    <Bar dataKey="totalValue" radius={[4, 4, 0, 0]}>
                                        {attemptsByStatus.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={statusColors[entry.status] || '#6B7280'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500">
                            Sin datos de valor
                        </div>
                    )}
                </div>

                {/* Recuperación por Vendedora */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                        Tasa de Recuperación por Vendedora
                    </h3>
                    {recoveryByVendor.length > 0 ? (
                        <div className="w-full h-[250px]">
                            <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0} debounce={200}>
                                <BarChart layout="vertical" data={recoveryByVendor} margin={{ top: 10, right: 20, left: 80, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                                    <XAxis type="number" tick={{ fill: axisColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} domain={[0, 100]} />
                                    <YAxis type="category" dataKey="vendorName" tick={{ fill: axisColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} width={75} />
                                    <Tooltip content={<VendorTooltip />} />
                                    <Bar dataKey="recoveryRate" radius={[0, 4, 4, 0]} fill="#D4AF37" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500">
                            Sin datos de recuperación por vendedora
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecoveryView;
