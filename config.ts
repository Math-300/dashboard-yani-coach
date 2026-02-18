// Configuración de conexión para Vercel
// -----------------------------------------------------------------------------
// El API de NocoDB está integrado en Vercel como serverless functions
// -----------------------------------------------------------------------------

// Helper para limpiar espacios accidentales (trim)
const getEnv = (key: string, defaultValue: string = '') => {
  // @ts-ignore - Vite specific
  const value = import.meta.env?.[key];
  return value ? String(value).trim() : defaultValue;
};

export const NOCODB_CONFIG = {
  // URL del API - en Vercel es el mismo dominio
  // El frontend detectará automáticamente la URL del servidor
  PROXY_URL: '',

  // URLs de NocoDB
  BASE_URL: 'https://app.nocodb.com'
};

// Helper para saber si el proxy está configurado
// En producción de Vercel siempre está configurado
// En desarrollo local, usamos datos demo
const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';

export const isApiConfigured = () => {
  if (isDev) return false; // En dev usamos datos demo
  return true; // En producción usamos la API
};
