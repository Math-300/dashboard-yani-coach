import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from 'recharts';
import { DollarSign, ShoppingCart, Percent, Users, Clock, Zap, TrendingUp, Layers, Activity } from 'lucide-react';
import KPICard from './KPICard';
import { Sale, Contact, Interaction, PurchaseAttempt, LeadStatus, InteractionType } from '../types';
import { isDateInRange } from '../services/noco';

interface BusinessViewProps {
  sales: Sale[];
  contacts: Contact[];
  interactions: Interaction[];
  attempts: PurchaseAttempt[];
  isDarkMode?: boolean;
  dateRange: { start: Date; end: Date }; // Receive date context
}

// COLORS: Gold, Emerald (Success), Amber (Warning), Red (Danger)
const COLORS = ['#D4AF37', '#10b981', '#f59e0b', '#ef4444'];

const BusinessView: React.FC<BusinessViewProps> = ({ sales, contacts, interactions, attempts, isDarkMode = false, dateRange }) => {

  // Theme constants
  const axisColor = isDarkMode ? '#9ca3af' : '#4b5563';
  const gridColor = isDarkMode ? '#374151' : '#e5e7eb';
  const tooltipBg = isDarkMode ? '#111827' : '#ffffff';
  const tooltipText = isDarkMode ? '#f3f4f6' : '#111827';
  const tooltipBorder = isDarkMode ? '#D4AF37' : '#e5e7eb';

  // Helper for USD Formatting
  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // --- 1. BASIC KPI CALCULATIONS ---

  // Filter contacts created within the selected date range for "New Leads" and "Conversion" metrics
  // ✅ CORREGIDO: Usar comparación de fechas que considera zona horaria local
  const newContactsInPeriod = contacts.filter(c => {
    return isDateInRange(c.createdAt, dateRange.start, dateRange.end);
  });

  // 🔍 DEBUG: Resumen del filtrado
  console.log(`[Filtrado] Total contacts: ${contacts.length} | In range: ${newContactsInPeriod.length} | Range: ${dateRange.start.toLocaleString('es-CO')} - ${dateRange.end.toLocaleString('es-CO')}`);

  const totalRevenue = sales.reduce((acc, sale) => acc + sale.amount, 0);
  const avgTicket = sales.length > 0 ? totalRevenue / sales.length : 0;

  // ✅ CORREGIDO: Conversion Rate basado en leads con resolución (Ganados + Perdidos)
  // Fórmula correcta: Ventas Ganadas / (Ventas Ganadas + Ventas Perdidas) × 100
  const closedWonContacts = contacts.filter(c => c.status === LeadStatus.CLOSED_WON).length;
  const closedLostContacts = contacts.filter(c => c.status === LeadStatus.CLOSED_LOST).length;
  const totalResolvedLeads = closedWonContacts + closedLostContacts;

  const conversionRate = totalResolvedLeads > 0
    ? ((closedWonContacts / totalResolvedLeads) * 100).toFixed(1)
    : '0';

  const newLeadsCount = newContactsInPeriod.length;

  // --- 2. BI METRICS CALCULATIONS ---

  // ✅ CORREGIDO: A. Sales Cycle - Usar campo calculado de NocoDB si está disponible
  let totalDaysToClose = 0;
  let closedSalesCount = 0;
  sales.forEach(sale => {
    // Priorizar el campo calculado de NocoDB
    if (sale.salesCycleDays !== undefined && sale.salesCycleDays !== null) {
      totalDaysToClose += sale.salesCycleDays;
      closedSalesCount++;
    } else {
      // Fallback: calcular manualmente si no viene de NocoDB
      const contact = contacts.find(c => c.id === sale.contactId);
      if (contact) {
        const created = new Date(contact.createdAt).getTime();
        const sold = new Date(sale.date).getTime();
        const diffDays = Math.max(0, Math.ceil((sold - created) / (1000 * 60 * 60 * 24)));
        totalDaysToClose += diffDays;
        closedSalesCount++;
      }
    }
  });
  const avgSalesCycle = closedSalesCount > 0 ? (totalDaysToClose / closedSalesCount).toFixed(1) : '0';

  // B. Touches to Close (Efficiency)
  let totalTouchesForSales = 0;
  sales.forEach(sale => {
    // Usar snapshot si está disponible
    if (sale.interactionCountSnapshot !== undefined && sale.interactionCountSnapshot !== null) {
      totalTouchesForSales += sale.interactionCountSnapshot;
    } else {
      // Fallback: calcular desde interacciones
      const saleDate = new Date(sale.date).getTime();
      const saleInteractions = interactions.filter(i => {
        const interactionDate = new Date(i.date).getTime();
        return i.contactId === sale.contactId && interactionDate <= saleDate;
      });
      totalTouchesForSales += saleInteractions.length;
    }
  });

  const avgTouchesToClose = sales.length > 0 ? (totalTouchesForSales / sales.length).toFixed(1) : '0';
  const touchesNum = parseFloat(avgTouchesToClose);
  let efficiencyText = "Estándar";
  if (touchesNum > 0 && touchesNum < 5) efficiencyText = "Alta Eficiencia";
  if (touchesNum > 12) efficiencyText = "Fricción Alta";


  // ✅ CORREGIDO: C. Weighted Pipeline - Usar EstimatedValue individual si está disponible
  const pipelineValue = contacts.reduce((acc, contact) => {
    // Usar el valor estimado del contacto si está disponible, sino usar avgTicket como fallback
    const contactValue = contact.estimatedValue && contact.estimatedValue > 0
      ? contact.estimatedValue
      : avgTicket;

    if (contact.status === LeadStatus.INTERESTED) return acc + (contactValue * 0.50);
    if (contact.status === LeadStatus.CONTACTED) return acc + (contactValue * 0.20);
    if (contact.status === LeadStatus.NEW) return acc + (contactValue * 0.05);
    return acc;
  }, 0);

  // D. Lead Hygiene (Aging)
  const now = new Date();
  const agingBuckets = { fresh: 0, following: 0, stagnant: 0 };
  const activeContacts = contacts.filter(c => c.status !== LeadStatus.CLOSED_WON && c.status !== LeadStatus.CLOSED_LOST);

  activeContacts.forEach(c => {
    const created = new Date(c.createdAt);
    const diffDays = Math.max(0, Math.ceil((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))) || 0;
    if (diffDays <= 7) agingBuckets.fresh++;
    else if (diffDays <= 30) agingBuckets.following++;
    else agingBuckets.stagnant++;
  });

  const agingData = [
    { name: '< 7 Días', value: agingBuckets.fresh, fill: '#10b981' },
    { name: '7-30 Días', value: agingBuckets.following, fill: '#f59e0b' },
    { name: '+30 Días', value: agingBuckets.stagnant, fill: '#ef4444' },
  ];

  // E. Channel Effectiveness
  const salesByChannel: Record<string, number> = { [InteractionType.CALL]: 0, [InteractionType.WHATSAPP]: 0, [InteractionType.EMAIL]: 0 };
  sales.forEach(sale => {
    const contactInteractions = interactions.filter(i => i.contactId === sale.contactId);
    if (contactInteractions.length === 0) return;
    const counts: Record<string, number> = {};
    contactInteractions.forEach(i => { counts[i.type] = (counts[i.type] || 0) + 1 });
    const mainChannel = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    salesByChannel[mainChannel] = (salesByChannel[mainChannel] || 0) + 1;
  });

  const channelData = Object.keys(salesByChannel).map(key => ({
    subject: key,
    A: salesByChannel[key],
    fullMark: sales.length,
  }));

  // --- 3. STANDARD CHARTS DATA ---
  const funnelData = [
    { name: 'Total Leads', value: contacts.length, fill: '#9ca3af' },
    { name: 'Nuevos (Per)', value: newContactsInPeriod.length, fill: '#60a5fa' },
    { name: 'Intento Compra', value: attempts.length, fill: '#EAD99F' },
    { name: 'Ventas', value: sales.length, fill: '#D4AF37' },
  ];

  const productSales: Record<string, number> = {};
  sales.forEach(s => { productSales[s.productName] = (productSales[s.productName] || 0) + s.amount; });
  const pieData = Object.keys(productSales).map(key => ({ name: key, value: productSales[key] }));

  const daysDiff = (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 3600 * 24);
  const showTime = daysDiff <= 1.5;

  const salesEvolutionData = sales.map((s) => ({
    date: showTime
      ? new Date(s.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      : new Date(s.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
    originalDate: new Date(s.date).getTime(),
    amount: s.amount
  })).sort((a, b) => a.originalDate - b.originalDate);


  return (
    <div className="space-y-8">

      {/* SECTION 1: FINANCIAL HEALTH */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center">
          <DollarSign className="w-5 h-5 text-gold-500 mr-2" />
          Salud Financiera
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Ingresos Totales"
            value={formatUSD(totalRevenue)}
            icon={<DollarSign className="w-6 h-6 text-gold-400" />}
            colorClass="bg-gray-900 border border-gold-500/30 shadow-inner"
            tooltip="Suma de todas las ventas cerradas en el período seleccionado"
          />
          <KPICard
            title="Ticket Promedio"
            value={formatUSD(avgTicket)}
            icon={<ShoppingCart className="w-6 h-6 text-gold-400" />}
            colorClass="bg-gray-900 border border-gold-500/30 shadow-inner"
            tooltip="Monto promedio de cada venta. Se calcula: Ingresos Totales ÷ Número de Ventas"
          />
          <KPICard
            title="Tasa de Conversión"
            value={`${conversionRate}%`}
            subValue="Ventas / Leads (Periodo)"
            icon={<Percent className="w-6 h-6 text-gold-400" />}
            colorClass="bg-gray-900 border border-gold-500/30 shadow-inner"
            tooltip="Porcentaje de leads que se convirtieron en clientes. Fórmula: Ganados ÷ (Ganados + Perdidos)"
          />
          <KPICard
            title="Leads Nuevos"
            value={newLeadsCount}
            subValue="En este periodo"
            icon={<Users className="w-6 h-6 text-gold-400" />}
            colorClass="bg-gray-900 border border-gold-500/30 shadow-inner"
            tooltip="Contactos creados en el período seleccionado que aún están en proceso"
          />
        </div>
      </div>

      {/* SECTION 2: EFFICIENCY & PREDICTION */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center">
          <Activity className="w-5 h-5 text-gold-500 mr-2" />
          Eficiencia & Predicción (BI)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Ciclo de Venta"
            value={`${avgSalesCycle} días`}
            subValue="Desde Lead a Cliente"
            icon={<Clock className="w-6 h-6 text-emerald-400" />}
            colorClass="bg-gray-800 border border-gray-700"
            tooltip="Días promedio desde que un lead entra hasta que concreta una compra"
          />
          <KPICard
            title="Esfuerzo de Cierre"
            value={`${avgTouchesToClose}`}
            subValue={efficiencyText}
            icon={<Zap className="w-6 h-6 text-amber-400" />}
            colorClass="bg-gray-800 border border-gray-700"
            tooltip="Número promedio de interacciones necesarias para cerrar una venta"
          />
          <KPICard
            title="Pipeline Ponderado"
            value={formatUSD(pipelineValue)}
            subValue="Proyección Probable"
            icon={<TrendingUp className="w-6 h-6 text-purple-400" />}
            colorClass="bg-gray-800 border border-gray-700"
            tooltip="Proyección de ingresos basada en la probabilidad de cierre de cada lead"
          />
          <KPICard
            title="Higiene de Leads"
            value={`${agingBuckets.fresh}`}
            subValue="Leads < 7 días (Frescos)"
            icon={<Layers className="w-6 h-6 text-blue-400" />}
            colorClass="bg-gray-800 border border-gray-700"
            tooltip="Leads activos con menos de 7 días de antigüedad. Indica gestión reciente"
          />
        </div>
      </div>

      {/* SECTION 3: DEEP DIVES CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Lead Aging Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Salud de Leads (Antigüedad)</h3>
          <div className="h-64 w-full" style={{ minHeight: '256px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{ fill: axisColor, fontSize: 12 }} stroke={axisColor} />
                <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }} />
                <Bar dataKey="value" barSize={30} radius={[0, 4, 4, 0]}>
                  {agingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Objetivo: Mantener la barra roja (Estancados) al mínimo.</p>
        </div>

        {/* Channel Effectiveness Radar */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Efectividad por Canal</h3>
          <div className="h-64 w-full" style={{ minHeight: '256px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={channelData}>
                <PolarGrid stroke={gridColor} />
                <PolarAngleAxis dataKey="subject" tick={{ fill: axisColor }} />
                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                <Radar name="Ventas" dataKey="A" stroke="#D4AF37" fill="#D4AF37" fillOpacity={0.4} />
                <RechartsTooltip contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Canal predominante en ventas cerradas.</p>
        </div>

        {/* Product Revenue Donut */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Mix de Productos</h3>
          <div className="h-64 w-full flex justify-center" style={{ minHeight: '256px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke={'#1f2937'} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: number) => formatUSD(value)} contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }} itemStyle={{ color: tooltipText }} />
                <Legend verticalAlign="bottom" height={36} formatter={(value) => <span style={{ color: axisColor }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Embudo de Conversión</h3>
          <div className="h-80 w-full" style={{ minHeight: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={funnelData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: axisColor }} stroke={axisColor} />
                <RechartsTooltip cursor={{ fill: 'rgba(212, 175, 55, 0.1)' }} contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }} itemStyle={{ color: tooltipText }} />
                <Bar dataKey="value" barSize={40} radius={[0, 4, 4, 0]}>
                  {funnelData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales Evolution */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Evolución de Ventas</h3>
          <div className="h-80 w-full" style={{ minHeight: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesEvolutionData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="date" tick={{ fill: axisColor }} stroke={axisColor} />
                <YAxis tick={{ fill: axisColor }} stroke={axisColor} />
                <RechartsTooltip formatter={(value: number) => formatUSD(value)} contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }} itemStyle={{ color: tooltipText }} />
                <Area type="monotone" dataKey="amount" stroke="#D4AF37" fillOpacity={1} fill="url(#colorGold)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessView;