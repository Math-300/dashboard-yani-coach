import React, { useMemo } from 'react';
import { DollarSign, Receipt, Percent, ShoppingBag, TrendingUp, BarChart3 } from 'lucide-react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import KPICard from './KPICard';
import { Sale } from '../types';
import {
    calculateTotalRevenue,
    calculateAverageTicket,
    calculateTotalDiscounts,
    calculateRevenueByProduct,
    calculateRevenueByCategory,
    calculateSalesTrend,
    formatCurrency,
    ProductRevenue,
    CategoryRevenue,
    TrendData
} from '../services/metricsCalculator';

interface SalesViewProps {
    sales: Sale[];
    dateRange: { start: Date; end: Date };
    isDarkMode: boolean;
}

/**
 * Vista de Ventas & Ingresos
 * 
 * Muestra KPIs de ventas, gráficos de tendencia, productos más vendidos
 * y distribución de ingresos por categoría.
 */
const SalesView: React.FC<SalesViewProps> = ({
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

    // Colores para gráficos
    const GOLD_COLORS = ['#D4AF37', '#B8860B', '#FFD700', '#FFA500', '#FF8C00', '#FF7F50', '#FF6347', '#FF4500', '#FFDAB9', '#FFE4B5'];
    const CATEGORY_COLORS = ['#D4AF37', '#B8860B', '#FFD700', '#FFA500'];

    // Calcular todas las métricas
    const metrics = useMemo(() => {
        const totalRevenue = calculateTotalRevenue(sales, dateRange);
        const averageTicket = calculateAverageTicket(sales);
        const discounts = calculateTotalDiscounts(sales);
        const productRevenue = calculateRevenueByProduct(sales);
        const categoryRevenue = calculateRevenueByCategory(sales);
        const salesTrend = calculateSalesTrend(sales, 'week');

        return {
            totalRevenue,
            averageTicket,
            discounts,
            productRevenue,
            categoryRevenue,
            salesTrend,
            totalSales: sales.length
        };
    }, [sales, dateRange]);

    // Top 10 productos para el gráfico
    const topProducts = useMemo(() => {
        return metrics.productRevenue.slice(0, 10);
    }, [metrics.productRevenue]);

    // Custom Tooltip para gráfico de tendencia
    const TrendTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload as TrendData;
            return (
                <div
                    className="px-3 py-2 rounded-lg shadow-lg border"
                    style={{
                        backgroundColor: tooltipBg,
                        borderColor: tooltipBorder,
                        color: tooltipText
                    }}
                >
                    <p className="font-semibold">{data.period}</p>
                    <p className="text-sm">
                        <span className="font-medium">{formatCurrency(data.revenue)}</span>
                    </p>
                    <p className="text-sm opacity-80">
                        {data.count} ventas
                    </p>
                </div>
            );
        }
        return null;
    };

    // Custom Tooltip para gráfico de productos
    const ProductTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload as ProductRevenue;
            return (
                <div
                    className="px-3 py-2 rounded-lg shadow-lg border"
                    style={{
                        backgroundColor: tooltipBg,
                        borderColor: tooltipBorder,
                        color: tooltipText
                    }}
                >
                    <p className="font-semibold">{data.productName}</p>
                    <p className="text-sm">Cantidad: <span className="font-medium">{data.quantity}</span></p>
                    <p className="text-sm">Ingresos: <span className="font-medium">{formatCurrency(data.revenue)}</span></p>
                    <p className="text-sm opacity-80">{data.percentage}% del total</p>
                </div>
            );
        }
        return null;
    };

    // Custom Tooltip para gráfico de categorías
    const CategoryTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload as CategoryRevenue;
            return (
                <div
                    className="px-3 py-2 rounded-lg shadow-lg border"
                    style={{
                        backgroundColor: tooltipBg,
                        borderColor: tooltipBorder,
                        color: tooltipText
                    }}
                >
                    <p className="font-semibold">{data.category}</p>
                    <p className="text-sm">Ingresos: <span className="font-medium">{formatCurrency(data.revenue)}</span></p>
                    <p className="text-sm">{data.count} ventas</p>
                    <p className="text-sm opacity-80">{data.percentage}% del total</p>
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
                        Ventas & Ingresos
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Análisis detallado de ventas, productos y distribución de ingresos
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <BarChart3 className="w-4 h-4" />
                    <span>{metrics.totalSales} ventas en el período</span>
                </div>
            </div>

            {/* Grid de KPIs - 4 columnas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* KPI 1: Ingresos Totales */}
                <KPICard
                    title="Ingresos Totales"
                    value={formatCurrency(metrics.totalRevenue)}
                    icon={<DollarSign className="w-6 h-6" />}
                    colorClass="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    tooltip="Suma total de los montos finales de todas las ventas en el período seleccionado."
                />

                {/* KPI 2: Ticket Promedio */}
                <KPICard
                    title="Ticket Promedio"
                    value={formatCurrency(metrics.averageTicket)}
                    icon={<Receipt className="w-6 h-6" />}
                    colorClass="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    tooltip="Valor promedio de cada venta. Fórmula: Total Ingresos / Cantidad de Ventas."
                />

                {/* KPI 3: Total Descuentos */}
                <KPICard
                    title="Total Descuentos"
                    value={formatCurrency(metrics.discounts.total)}
                    subValue={metrics.discounts.count > 0 ? `Prom: ${formatCurrency(metrics.discounts.average)} (${metrics.discounts.count} ventas)` : 'Sin descuentos'}
                    icon={<Percent className="w-6 h-6" />}
                    colorClass="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                    tooltip="Suma total de descuentos aplicados en las ventas. Incluye el promedio por venta con descuento."
                />

                {/* KPI 4: Cantidad de Ventas */}
                <KPICard
                    title="Cantidad de Ventas"
                    value={metrics.totalSales}
                    icon={<ShoppingBag className="w-6 h-6" />}
                    colorClass="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                    tooltip="Número total de ventas realizadas en el período seleccionado."
                />
            </div>

            {/* Gráficos - Primera fila */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico de Tendencia de Ventas */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Tendencia de Ventas
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Ingresos por semana
                            </p>
                        </div>
                        <TrendingUp className="w-5 h-5 text-gold-500" />
                    </div>
                    <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0} debounce={200}>
                            <AreaChart data={metrics.salesTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorGold" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                <XAxis
                                    dataKey="period"
                                    tick={{ fill: axisColor, fontSize: 11 }}
                                    axisLine={{ stroke: gridColor }}
                                />
                                <YAxis
                                    tick={{ fill: axisColor, fontSize: 11 }}
                                    axisLine={{ stroke: gridColor }}
                                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                                />
                                <Tooltip content={<TrendTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#D4AF37"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorGold)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Gráfico de Productos Más Vendidos */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Productos Más Vendidos
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Top 10 por cantidad de ventas
                            </p>
                        </div>
                        <ShoppingBag className="w-5 h-5 text-gold-500" />
                    </div>
                    <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0} debounce={200}>
                            <BarChart
                                layout="vertical"
                                data={topProducts}
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
                                    dataKey="productName"
                                    tick={{ fill: axisColor, fontSize: 10 }}
                                    axisLine={{ stroke: gridColor }}
                                    width={75}
                                />
                                <Tooltip content={<ProductTooltip />} />
                                <Bar dataKey="quantity" radius={[0, 4, 4, 0]}>
                                    {topProducts.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={GOLD_COLORS[index % GOLD_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Gráfico de Categorías */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico de Ingresos por Categoría */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Ingresos por Categoría
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Distribución de ingresos por tipo de producto
                            </p>
                        </div>
                        <BarChart3 className="w-5 h-5 text-gold-500" />
                    </div>
                    <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0} debounce={200}>
                            <PieChart>
                                <Pie
                                    data={metrics.categoryRevenue}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="revenue"
                                    label={({ category, percentage }) => `${category}: ${percentage}%`}
                                    labelLine={{ stroke: axisColor }}
                                >
                                    {metrics.categoryRevenue.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CategoryTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Resumen de Categorías */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Resumen por Categoría
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Desglose detallado
                            </p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {metrics.categoryRevenue.map((cat, index) => (
                            <div key={cat.category} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{
                                            backgroundColor: CATEGORY_COLORS[index % 4]
                                        }}
                                    />
                                    <span className="font-medium text-gray-900 dark:text-white">{cat.category}</span>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(cat.revenue)}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{cat.count} ventas • {cat.percentage}%</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tabla de Ranking de Productos */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Ranking de Productos
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Detalle de ventas por producto
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                                    #
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                                    Producto
                                </th>
                                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                                    Cantidad
                                </th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                                    Ingresos
                                </th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                                    % del Total
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {metrics.productRevenue.slice(0, 10).map((product, index) => (
                                <tr
                                    key={product.productName}
                                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                                >
                                    <td className="py-3 px-4">
                                        <span className={`
                                            inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                                            ${index === 0 ? 'bg-gold-500 text-white' :
                                                index === 1 ? 'bg-gray-300 text-gray-700' :
                                                    index === 2 ? 'bg-amber-600 text-white' :
                                                        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}
                                        `}>
                                            {index + 1}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {product.productName}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="text-gray-600 dark:text-gray-300">
                                            {product.quantity}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {formatCurrency(product.revenue)}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gold-500 rounded-full"
                                                    style={{ width: `${product.percentage}%` }}
                                                />
                                            </div>
                                            <span className="text-sm text-gray-500 dark:text-gray-400 w-12 text-right">
                                                {product.percentage}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {metrics.productRevenue.length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No hay datos de ventas para mostrar
                    </div>
                )}
            </div>

            {/* Información adicional */}
            <div className="bg-gold-900/10 dark:bg-gold-900/20 border border-gold-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-gold-500/20">
                        <TrendingUp className="w-5 h-5 text-gold-500" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-gold-700 dark:text-gold-300">
                            Análisis de Ventas
                        </h4>
                        <p className="text-sm text-gold-600/80 dark:text-gold-400/80 mt-1">
                            {metrics.totalSales > 0 ? (
                                <>
                                    Has realizado <strong>{metrics.totalSales} ventas</strong> con un total de <strong>{formatCurrency(metrics.totalRevenue)}</strong> en ingresos.
                                    El ticket promedio es de <strong>{formatCurrency(metrics.averageTicket)}</strong>.
                                    {metrics.productRevenue.length > 0 && (
                                        <span> Tu producto más vendido es <strong>{metrics.productRevenue[0].productName}</strong> con {metrics.productRevenue[0].quantity} ventas.</span>
                                    )}
                                </>
                            ) : (
                                'No hay ventas registradas en el período seleccionado.'
                            )}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalesView;
