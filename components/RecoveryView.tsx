import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { AlertCircle, MapPin, RefreshCw } from 'lucide-react';
import { Contact, PurchaseAttempt, Seller, LostReason, PurchaseAttemptStatus } from '../types';

interface RecoveryViewProps {
  contacts: Contact[];
  attempts: PurchaseAttempt[];
  sellers: Seller[];
  isDarkMode?: boolean;
}

const RecoveryView: React.FC<RecoveryViewProps> = ({ contacts, attempts, sellers, isDarkMode = false }) => {

  // Chart Colors based on theme
  const axisColor = isDarkMode ? '#9ca3af' : '#4b5563'; // gray-400 vs gray-600
  const gridColor = isDarkMode ? '#374151' : '#e5e7eb'; // gray-700 vs gray-200
  const tooltipBg = isDarkMode ? '#111827' : '#ffffff'; // gray-900 vs white
  const tooltipText = isDarkMode ? '#f3f4f6' : '#111827'; // gray-100 vs gray-900
  const tooltipBorder = isDarkMode ? '#D4AF37' : '#e5e7eb';

  // 1. Loss Analysis
  const lossReasons: Record<string, number> = {};
  contacts.forEach(c => {
    if (c.lostReason) {
      lossReasons[c.lostReason] = (lossReasons[c.lostReason] || 0) + 1;
    }
  });
  
  const lossData = Object.keys(lossReasons).map(reason => ({
    reason,
    count: lossReasons[reason]
  })).sort((a,b) => b.count - a.count);

  // 2. Geo Distribution
  const geoDistribution: Record<string, number> = {};
  contacts.forEach(c => {
    geoDistribution[c.country] = (geoDistribution[c.country] || 0) + 1;
  });
  
  const geoData = Object.keys(geoDistribution).map(country => ({
    country,
    count: geoDistribution[country]
  })).sort((a,b) => b.count - a.count).slice(0, 5); // Top 5

  // 3. Recovery Table Data
  const recoveryOpportunities = attempts.filter(
    a => a.status !== PurchaseAttemptStatus.SUCCESSFUL
  ).map(attempt => {
    const contact = contacts.find(c => c.id === attempt.contactId);
    const seller = sellers.find(s => s.id === attempt.recoverySellerId);
    return {
      ...attempt,
      contactName: contact?.name || 'Desconocido',
      sellerName: seller?.name || 'No Asignado'
    };
  });

  return (
    <div className="space-y-6">
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loss Reasons */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <div className="flex items-center space-x-2 mb-4">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Motivos de No Compra</h3>
          </div>
          <div className="h-64" style={{ minHeight: '256px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={lossData}
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={gridColor} />
                <XAxis type="number" hide />
                <YAxis dataKey="reason" type="category" width={100} tick={{fontSize: 12, fill: axisColor}} stroke={axisColor} />
                <Tooltip 
                  cursor={{fill: isDarkMode ? 'rgba(212, 175, 55, 0.1)' : 'rgba(0,0,0,0.05)'}}
                  contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }}
                  itemStyle={{ color: tooltipText }}
                />
                <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Geo Distribution */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <div className="flex items-center space-x-2 mb-4">
            <MapPin className="w-5 h-5 text-gold-500" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Top Países (Leads)</h3>
          </div>
          <div className="h-64" style={{ minHeight: '256px' }}>
             <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={geoData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="country" tick={{fontSize: 12, fill: axisColor}} stroke={axisColor} />
                <YAxis tick={{fill: axisColor}} stroke={axisColor} />
                <Tooltip 
                  cursor={{fill: isDarkMode ? 'rgba(212, 175, 55, 0.1)' : 'rgba(0,0,0,0.05)'}}
                  contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }}
                  itemStyle={{ color: tooltipText }}
                />
                <Bar dataKey="count" fill="#D4AF37" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recovery Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/40">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5 text-gold-600 dark:text-gold-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gold-200">Dinero sobre la mesa (Recuperación)</h3>
          </div>
          <span className="bg-white dark:bg-gray-800 px-3 py-1 rounded-full text-xs font-bold text-gold-600 dark:text-gold-400 shadow-sm border border-gold-200 dark:border-gray-600">
            {recoveryOpportunities.length} Oportunidades
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-750 text-gray-900 dark:text-gray-100 font-medium">
              <tr>
                <th className="px-6 py-3">Lead</th>
                <th className="px-6 py-3">Fecha Intento</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3">Asignado a</th>
                <th className="px-6 py-3 text-right">Monto</th>
                <th className="px-6 py-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {recoveryOpportunities.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{row.contactName}</td>
                  <td className="px-6 py-4">{new Date(row.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{row.sellerName}</td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                     {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(row.amount)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button className="text-gray-900 dark:text-gold-400 hover:text-black dark:hover:text-gold-200 font-medium text-xs border border-gray-300 dark:border-gold-700 px-3 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      Gestionar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default RecoveryView;