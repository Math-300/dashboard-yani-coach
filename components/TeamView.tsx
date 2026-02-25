import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Seller, Interaction, Sale, Contact, InteractionType, LeadStatus } from '../types';
import { isDateInRange } from '../services/noco';

interface TeamViewProps {
  sellers: Seller[];
  interactions: Interaction[];
  sales: Sale[];
  contacts: Contact[];
  dateRange: { start: Date; end: Date };
  isDarkMode?: boolean;
}

// Subcomponente para Avatar Seguro
const AvatarWithFallback: React.FC<{ name: string; url?: string }> = ({ name, url }) => {
  const [imgError, setImgError] = useState(false);

  if (url && !imgError) {
    return (
      <img
        src={url}
        alt={name}
        onError={() => setImgError(true)}
        className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-600 border border-gray-200 dark:border-gray-600 object-cover"
      />
    );
  }

  return (
    <div className="w-9 h-9 rounded-full bg-gold-100 dark:bg-gold-900/30 border border-gold-200 dark:border-gold-700 flex items-center justify-center text-gold-700 dark:text-gold-400 text-xs font-bold">
      {name.substring(0, 2).toUpperCase()}
    </div>
  );
};

const TeamView: React.FC<TeamViewProps> = ({ sellers, interactions, sales, contacts, dateRange, isDarkMode = false }) => {

  // Chart Colors based on theme
  const axisColor = isDarkMode ? '#9ca3af' : '#4b5563';
  const gridColor = isDarkMode ? '#374151' : '#e5e7eb';
  const tooltipBg = isDarkMode ? '#111827' : '#ffffff';
  const tooltipText = isDarkMode ? '#f3f4f6' : '#111827';
  const tooltipBorder = isDarkMode ? '#D4AF37' : '#e5e7eb';

  // Helper to filter dates - ✅ CORREGIDO: Usar comparación con zona horaria
  const isWithinRange = (dateString: string) => {
    return isDateInRange(dateString, dateRange.start, dateRange.end);
  };

  // 1. Leaderboard Calculation
  const leaderboard = sellers.map(seller => {
    // Basic Counts
    const newLeadsAssignedInPeriod = contacts.filter(c =>
      c.assignedSellerId === seller.id && isWithinRange(c.createdAt)
    );

    const leadsAssignedTotal = contacts.filter(c => c.assignedSellerId === seller.id).length;
    const interactionsCount = interactions.filter(i => i.sellerId === seller.id).length;

    // Sales filtered by seller (already date filtered in service if passed that way, but here we receive all sales in period)
    const closedSales = sales.filter(s => s.sellerId === seller.id);
    const revenue = closedSales.reduce((sum, s) => sum + s.amount, 0);

    // ✅ CORREGIDO: Close Rate basado en leads con resolución, no en leads nuevos
    // Fórmula: Ventas Ganadas / (Ventas Ganadas + Ventas Perdidas) × 100
    const sellerContacts = contacts.filter(c => c.assignedSellerId === seller.id);
    const sellerWonLeads = sellerContacts.filter(c => c.status === LeadStatus.CLOSED_WON).length;
    const sellerLostLeads = sellerContacts.filter(c => c.status === LeadStatus.CLOSED_LOST).length;
    const sellerResolvedLeads = sellerWonLeads + sellerLostLeads;

    const closeRate = sellerResolvedLeads > 0
      ? (sellerWonLeads / sellerResolvedLeads) * 100
      : 0;

    // Efficiency Metric: Touches per Sale
    let touchesForClosedDeals = 0;
    closedSales.forEach(sale => {
      // Usar snapshot si está disponible
      if (sale.interactionCountSnapshot !== undefined && sale.interactionCountSnapshot !== null) {
        touchesForClosedDeals += sale.interactionCountSnapshot;
      } else {
        const saleDate = new Date(sale.date).getTime();
        const touches = interactions.filter(i =>
          i.contactId === sale.contactId && new Date(i.date).getTime() <= saleDate
        ).length;
        touchesForClosedDeals += touches;
      }
    });
    const avgTouchesPerSale = closedSales.length > 0 ? (touchesForClosedDeals / closedSales.length).toFixed(1) : '0';

    // ✅ CORREGIDO: Velocity Metric - Usar Sales_Cycle_Days de NocoDB si está disponible
    let totalCycleDays = 0;
    let cycleCount = 0;
    closedSales.forEach(sale => {
      if (sale.salesCycleDays !== undefined && sale.salesCycleDays !== null) {
        totalCycleDays += sale.salesCycleDays;
        cycleCount++;
      } else {
        // Fallback: calcular manualmente
        const contact = contacts.find(c => c.id === sale.contactId);
        if (contact) {
          const created = new Date(contact.createdAt).getTime();
          const sold = new Date(sale.date).getTime();
          const diff = Math.max(0, Math.ceil((sold - created) / (1000 * 60 * 60 * 24)));
          totalCycleDays += diff;
          cycleCount++;
        }
      }
    });
    const avgSalesCycle = cycleCount > 0 ? parseFloat((totalCycleDays / cycleCount).toFixed(1)) : 0;

    // Hygiene Metric: Average Age of Active Leads
    const activeLeads = contacts.filter(c =>
      c.assignedSellerId === seller.id &&
      c.status !== LeadStatus.CLOSED_WON &&
      c.status !== LeadStatus.CLOSED_LOST
    );
    let totalAgeDays = 0;
    const now = new Date();
    activeLeads.forEach(lead => {
      const created = new Date(lead.createdAt).getTime();
      const diff = Math.max(0, Math.ceil((now.getTime() - created) / (1000 * 60 * 60 * 24)));
      totalAgeDays += diff;
    });
    const avgLeadAge = activeLeads.length > 0 ? parseFloat((totalAgeDays / activeLeads.length).toFixed(1)) : 0;

    return {
      ...seller,
      leadsAssigned: newLeadsAssignedInPeriod.length,
      totalLeads: leadsAssignedTotal,
      interactionsCount,
      salesCount: closedSales.length,
      revenue,
      closeRate,
      avgTouchesPerSale,
      avgSalesCycle,
      avgLeadAge
    };
  }).sort((a, b) => {
    // Secondary sort by sales count to prevent random jumps on ties
    if (b.revenue !== a.revenue) return b.revenue - a.revenue;
    return b.salesCount - a.salesCount;
  });

  // 2. Activity Chart Data
  const activityData = sellers.map(seller => {
    const sellerInteractions = interactions.filter(i => i.sellerId === seller.id);
    return {
      name: seller.name,
      [InteractionType.CALL]: sellerInteractions.filter(i => i.type === InteractionType.CALL).length,
      [InteractionType.WHATSAPP]: sellerInteractions.filter(i => i.type === InteractionType.WHATSAPP).length,
      [InteractionType.EMAIL]: sellerInteractions.filter(i => i.type === InteractionType.EMAIL).length,
    };
  });

  const getCycleColor = (days: number) => {
    if (days === 0) return 'text-gray-400';
    if (days < 7) return 'text-emerald-500 font-bold';
    if (days < 15) return 'text-amber-500';
    return 'text-red-500';
  };

  const getAgeColor = (days: number) => {
    if (days === 0) return 'text-gray-400';
    if (days < 10) return 'text-emerald-500';
    if (days < 30) return 'text-amber-500';
    return 'text-red-500 font-bold';
  };

  return (
    <div className="space-y-8">

      {/* Leaderboard Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Ranking de Rendimiento & Eficiencia</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-750 text-gray-900 dark:text-gray-100 font-medium border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4">Asesora</th>
                <th className="px-6 py-4 text-center" title="Leads nuevos asignados en el período seleccionado">Leads (Nuevos)</th>
                <th className="px-6 py-4 text-center" title="Días promedio desde que un lead entra hasta que compra">Ciclo Venta</th>
                <th className="px-6 py-4 text-center" title="Antigüedad promedio de los leads que aún no se cierran">Antigüedad Activa</th>
                <th className="px-6 py-4 text-center" title="Número promedio de interacciones para cerrar una venta">Toques/Cierre</th>
                <th className="px-6 py-4 text-center" title="Ventas cerradas en el período">Ventas</th>
                <th className="px-6 py-4 text-center" title="Porcentaje de cierre: Ganados ÷ (Ganados + Perdidos)">% Cierre</th>
                <th className="px-6 py-4 text-right" title="Ingresos totales generados por esta asesora">Facturación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {leaderboard.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                  <td className="px-6 py-4 flex items-center space-x-3">
                    <AvatarWithFallback name={row.name} url={row.avatarUrl} />
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white block">{row.name}</span>
                      <span className="text-xs text-gray-400">{row.interactionsCount} interacciones</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-medium">
                    {row.leadsAssigned}
                    <span className="text-xs text-gray-500 block">de {row.totalLeads} total</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`${getCycleColor(row.avgSalesCycle)} bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs`}>
                      {row.avgSalesCycle > 0 ? `${row.avgSalesCycle} d` : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`${getAgeColor(row.avgLeadAge)} bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs`}>
                      {row.avgLeadAge > 0 ? `${row.avgLeadAge} d` : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded text-xs font-mono">
                      {row.avgTouchesPerSale}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-gray-800 dark:text-white">{row.salesCount}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${row.closeRate > 10
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                      {row.closeRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-gold-600 dark:text-gold-400">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(row.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Productivity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Actividad por Asesora</h3>
          <div className="h-80" style={{ minHeight: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activityData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="name" tick={{ fill: axisColor }} stroke={axisColor} />
                <YAxis tick={{ fill: axisColor }} stroke={axisColor} />
                <Tooltip
                  cursor={{ fill: isDarkMode ? 'rgba(212, 175, 55, 0.1)' : 'rgba(0,0,0,0.05)' }}
                  contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }}
                  itemStyle={{ color: tooltipText }}
                />
                <Legend formatter={(value) => <span style={{ color: axisColor }}>{value}</span>} />
                <Bar dataKey={InteractionType.CALL} stackId="a" fill="#D4AF37" name="Llamada" />
                <Bar dataKey={InteractionType.WHATSAPP} stackId="a" fill="#10b981" name="WhatsApp" />
                <Bar dataKey={InteractionType.EMAIL} stackId="a" fill="#9ca3af" name="Email" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-center items-center text-center transition-colors duration-300">
          <div className="p-4 bg-gray-900 dark:bg-gray-700 rounded-full mb-4 shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gold-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tiempo Promedio de Respuesta</h3>
          <p className="text-4xl font-bold text-gray-800 dark:text-gold-400 mt-2">2h 15m</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Desde lead creado hasta 1ra interacción</p>
          <div className="mt-4 w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-gold-500 w-3/4" title="Performance relative to target"></div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Meta: Menos de 4 horas</p>
        </div>
      </div>
    </div>
  );
};

export default TeamView;