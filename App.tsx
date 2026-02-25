import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LayoutDashboard, Info, BarChart3, DollarSign, UserCheck, GitBranch, RefreshCw, AlertTriangle, MessageCircle, X } from 'lucide-react';
import ExecutiveView from './components/ExecutiveView';
import SalesView from './components/SalesView';
import PerformanceView from './components/PerformanceView';
import PipelineView from './components/PipelineView';
import DateRangePicker from './components/DateRangePicker';
import ChatAssistant from './components/ChatAssistant';
import { useDashboardData } from './hooks/useDashboardData';
import { AuthProvider, useAuth } from './auth/AuthContext';
import AuthGuard from './auth/AuthGuard';
import LoginView from './components/LoginView';
import { logout } from './services/authService';

function DashboardShell() {
  const [activeTab, setActiveTab] = useState<'executive' | 'sales' | 'performance' | 'pipeline' | 'assistant'>('executive');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { refreshSession } = useAuth();

  // Force Dark Mode always
  const isDarkMode = true;

  // Initialize Dates: Default to "TODAY"
  const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  });

  // ✅ NUEVO: Usar hook con caché integrado
  // Los datos se cargan UNA sola vez y el filtrado es en el cliente
  const {
    contacts,
    allContacts, // 🚀 NUEVO: Todos los contactos para embudo y pipeline
    interactions,
    sales,
    attempts,
    sellers,
    isLoading,
    isDemo,
    error,
    isNetworkError,
    refresh,
    isInitialLoad
  } = useDashboardData(dateRange.start, dateRange.end);

  const handleDateChange = (start: Date, end: Date) => {
    setDateRange({ start, end });
  };


  // 🔧 Debug + fix: Recalcular tamaños de Recharts al cambiar de pestaña
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const triggerResize = () => window.dispatchEvent(new Event('resize'));

    const timeoutId = window.setTimeout(() => {
      triggerResize();
      window.setTimeout(triggerResize, 200);

      const containers = Array.from(document.querySelectorAll('.recharts-responsive-container'));
      if (containers.length === 0) return;

      // Debug logging only when explicitly requested
      if (window.location.search.includes('debugCharts=1')) {
        console.warn(`[ChartSize] activeTab=${activeTab} containers=${containers.length}`);
        containers.forEach((el, index) => {
          const rect = el.getBoundingClientRect();
          const parent = (el as HTMLElement).parentElement;
          const parentRect = parent ? parent.getBoundingClientRect() : null;
          const parentStyle = parent ? window.getComputedStyle(parent) : null;
          console.warn(
            `[ChartSize] #${index} w=${Math.round(rect.width)} h=${Math.round(rect.height)} ` +
            `parentW=${parentRect ? Math.round(parentRect.width) : 'n/a'} parentH=${parentRect ? Math.round(parentRect.height) : 'n/a'} ` +
            `parentDisplay=${parentStyle?.display || 'n/a'} parentMinH=${parentStyle?.minHeight || 'n/a'} parentHeight=${parentStyle?.height || 'n/a'}`
          );
        });
      }
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [activeTab, isLoading, isInitialLoad]);

  const tabs = [
    { id: 'executive', label: 'Resumen Ejecutivo', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'sales', label: 'Ventas & Ingresos', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'performance', label: 'Desempeño Vendedoras', icon: <UserCheck className="w-4 h-4" /> },
    { id: 'pipeline', label: 'Pipeline & Actividad', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'assistant', label: 'Asistente Yani', icon: <MessageCircle className="w-4 h-4" /> },
  ];

  return (
    <div className="dark">
      <div
        className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans pb-20 transition-colors duration-300"
        key={activeTab}
      >

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
                {/* Botón de refrescar datos */}
                <button
                  onClick={refresh}
                  disabled={isLoading}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  title="Refrescar datos desde NocoDB"
                >
                  <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={async () => {
                    await logout();
                    await refreshSession();
                  }}
                  className="px-3 py-2 rounded-lg bg-black/40 border border-gold-500/30 text-xs uppercase tracking-[0.2em] text-gold-200 hover:border-gold-400/70 hover:text-gold-100 transition-colors"
                  title="Cerrar sesión"
                >
                  Salir
                </button>

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

          {/* Error Banner */}
          {error && (
            <div className="mb-6 bg-red-900/20 border border-red-800/50 rounded-lg p-4 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-red-200">
                  {isNetworkError ? 'Error de conexión' : 'Error al cargar datos'}
                </h4>
                <p className="text-xs text-red-200/70 mt-1">
                  {isNetworkError
                    ? 'No se pudo conectar con el servidor. Verifica tu conexión a internet e intenta nuevamente.'
                    : error.message
                  }
                </p>
                {isNetworkError && (
                  <button
                    onClick={refresh}
                    disabled={isLoading}
                    className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white text-sm font-medium rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>Reintentar</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Demo Mode Banner */}
          {isDemo && !isLoading && (
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

          {/* Loading State - Solo mostrar en carga inicial si no hay error */}
          {isInitialLoad && !error ? (
            <div className="flex flex-col justify-center items-center h-64 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Cargando datos desde NocoDB...</p>
            </div>
          ) : error && isInitialLoad ? (
            // Si hay error durante la carga inicial, mostrar placeholder vacío
            <div className="flex flex-col justify-center items-center h-64">
              <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos disponibles</p>
            </div>
          ) : (
            <div className="animate-fade-in-up">
              {activeTab === 'executive' && (
                <ExecutiveView
                  contacts={contacts}
                  sales={sales}
                  dateRange={dateRange}
                  isDarkMode={isDarkMode}
                />
              )}
              {activeTab === 'sales' && (
                <SalesView
                  sales={sales}
                  dateRange={dateRange}
                  isDarkMode={isDarkMode}
                />
              )}
              {activeTab === 'performance' && (
                <PerformanceView
                  contacts={contacts}
                  interactions={interactions}
                  sales={sales}
                  sellers={sellers}
                  dateRange={dateRange}
                  isDarkMode={isDarkMode}
                />
              )}
              {activeTab === 'pipeline' && (
                <PipelineView
                  contacts={contacts}
                  interactions={interactions}
                  dateRange={dateRange}
                  isDarkMode={isDarkMode}
                />
              )}
              {activeTab === 'assistant' && (
                <ChatAssistant />
              )}
            </div>
          )}
        </main>

        {/* Floating Chat Button */}
        <button
          type="button"
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-50 inline-flex items-center justify-center w-14 h-14 rounded-full bg-gold-500 text-white shadow-lg hover:bg-gold-400 transition-colors"
          aria-label="Abrir asistente de IA"
        >
          <MessageCircle className="w-6 h-6" />
        </button>

        {/* Chat Popup */}
        {isChatOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/40" onClick={() => setIsChatOpen(false)} />
            <div className="relative w-full sm:w-[420px] h-[70vh] max-h-[720px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <MessageCircle className="w-4 h-4 text-gold-500" />
                  Asistente Yani
                </div>
                <button
                  type="button"
                  onClick={() => setIsChatOpen(false)}
                  className="p-2 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  aria-label="Cerrar asistente"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="h-[calc(70vh-52px)] max-h-[668px]">
                <ChatAssistant />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginView />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <DashboardShell />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
