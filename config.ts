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
// En Vercel, siempre usamos el API routes interno
export const isApiConfigured = () => {
  // En producción de Vercel siempre está configurado
  // En desarrollo local, se usan datos demo si no hay configuración
  return true;
};
