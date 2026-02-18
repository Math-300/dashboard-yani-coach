// Configuración de conexión al Proxy (que conecta a NocoDB)
// -----------------------------------------------------------------------------
// ✅ SEGURO: El token ahora está en el servidor proxy, NO en el código del cliente
// -----------------------------------------------------------------------------

// Helper para limpiar espacios accidentales (trim)
const getEnv = (key: string, defaultValue: string = '') => {
  // @ts-ignore - Vite specific
  const value = import.meta.env?.[key];
  return value ? String(value).trim() : defaultValue;
};

// Log de depuración inicial
console.groupCollapsed('[Config] Cargando configuración del proxy...');
console.log('Proxy URL:', getEnv('VITE_PROXY_URL') ? 'OK' : 'Usando valor por defecto');
console.groupEnd();

export const NOCODB_CONFIG = {
  // URL del proxy (Vercel o servidor local)
  // Desarrollo: http://localhost:3001
  // Producción Vercel: https://tu-proyecto.vercel.app
  PROXY_URL: getEnv('VITE_PROXY_URL', 'http://localhost:3001'),

  // URLs de NocoDB ya no son necesarias aquí (el proxy las maneja)
  BASE_URL: 'https://app.nocodb.com'
};

// Helper para saber si el proxy está configurado
export const isApiConfigured = () => {
  const proxyUrl = NOCODB_CONFIG.PROXY_URL;
  return proxyUrl && proxyUrl.length > 0;
};