import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Target, Info } from 'lucide-react';
import BusinessView from './components/BusinessView';
import TeamView from './components/TeamView';
import RecoveryView from './components/RecoveryView';
import DateRangePicker from './components/DateRangePicker';
import { getDashboardData } from './services/dataService';
import { Contact, Interaction, Sale, PurchaseAttempt, Seller } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<'business' | 'team' | 'recovery'>('business');
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  
  // Force Dark Mode always
  const isDarkMode = true;
  
  // State for data
  const [data, setData] = useState<{
    contacts: Contact[];
    interactions: Interaction[];
    sales: Sale[];
    attempts: PurchaseAttempt[];
    sellers: Seller[];
  }>({ contacts: [], interactions: [], sales: [], attempts: [], sellers: [] });

  // Initialize Dates: Default to "TODAY"
  const [dateRange, setDateRange] = useState<{start: Date, end: Date}>(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0); 
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const result = await getDashboardData(dateRange.start, dateRange.end);
      setData(result);
      if (result.isDemo) setIsDemo(true);
      setLoading(false);
    };

    fetchData();
  }, [dateRange]);

  const handleDateChange = (start: Date, end: Date) => {
    setDateRange({ start, end });
  };

  const tabs = [
    { id: 'business', label: 'Visión General', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'team', label: 'Equipo', icon: <Users className="w-4 h-4" /> },
    { id: 'recovery', label: 'Calidad & Recuperación', icon: <Target className="w-4 h-4" /> },
  ];

  return (
    <div className="dark">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans pb-20 transition-colors duration-300">
        
        {/* Top Navigation Bar */}
        <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <div className="bg-gray-900 dark:bg-gray-800 p-2 rounded-lg mr-3 shadow-lg border border-gold-500/30">
                  <LayoutDashboard className="w-6 h-6 text-gold-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                    Yani<span className="text-gold-500">Coach</span>
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gold-200/60 uppercase tracking-wider font-semibold">Analytics Dashboard</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <DateRangePicker 
                  startDate={dateRange.start}
                  endDate={dateRange.end}
                  onChange={handleDateChange}
                />
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex space-x-8 -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    flex items-center space-x-2 pb-4 px-1 border-b-2 font-medium text-sm transition-all duration-200
                    ${activeTab === tab.id 
                      ? 'border-gold-500 text-gray-900 dark:text-gold-400' 
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gold-200 hover:border-gray-300 dark:hover:border-gray-600'}
                  `}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          
          {isDemo && !loading && (
            <div className="mb-6 bg-gold-900/20 border border-gold-800/50 rounded-lg p-3 flex items-start space-x-3">
              <Info className="w-5 h-5 text-gold-400 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-gold-200">Modo de Demostración Activo</h4>
                <p className="text-xs text-gold-200/70">
                  Estás viendo datos generados automáticamente porque no se detectó conexión a NocoDB. 
                  Para ver datos reales, configura <code>VITE_NOCODB_TOKEN</code> y <code>VITE_NOCODB_URL</code> en tus variables de entorno.
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500"></div>
            </div>
          ) : (
            <div className="animate-fade-in-up">
              {activeTab === 'business' && (
                <BusinessView 
                  sales={data.sales} 
                  contacts={data.contacts}
                  interactions={data.interactions}
                  attempts={data.attempts}
                  dateRange={dateRange} 
                  isDarkMode={isDarkMode}
                />
              )}
              {activeTab === 'team' && (
                <TeamView 
                  sellers={data.sellers}
                  interactions={data.interactions}
                  sales={data.sales}
                  contacts={data.contacts}
                  dateRange={dateRange} 
                  isDarkMode={isDarkMode}
                />
              )}
              {activeTab === 'recovery' && (
                <RecoveryView 
                  contacts={data.contacts}
                  attempts={data.attempts}
                  sellers={data.sellers}
                  isDarkMode={isDarkMode}
                />
              )}
            </div>
          )}
        </main>

      </div>
    </div>
  );
}

export default App;