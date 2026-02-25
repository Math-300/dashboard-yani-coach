// Configuración de conexión para Vercel y Desarrollo Local
// -----------------------------------------------------------------------------
// El API de NocoDB está integrado en Vercel como serverless functions
// En desarrollo local, se puede conectar directamente a NocoDB
// -----------------------------------------------------------------------------

// Helper para limpiar espacios accidentales (trim)
const getEnv = (key: string, defaultValue: string = '') => {
  // @ts-ignore - Vite specific
  const value = import.meta.env?.[key];
  return value ? String(value).trim() : defaultValue;
};

// Detectar si estamos en desarrollo local
const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';

// Variables de entorno para conexión directa (solo en desarrollo local)
const NOCODB_TOKEN = getEnv('VITE_NOCODB_TOKEN');
const NOCODB_URL = getEnv('VITE_NOCODB_URL', 'https://app.nocodb.com');

// IDs de las tablas (configurables por variable de entorno)
export const TABLE_IDS = {
  sellers: getEnv('VITE_TABLE_SELLERS', 'me6kwgo0qvg0aug'),
  contacts: getEnv('VITE_TABLE_CONTACTS', 'mrwhtwissgz1xzr'),
  interactions: getEnv('VITE_TABLE_INTERACTIONS', 'm6gx25reozjbbt3'),
  sales: getEnv('VITE_TABLE_SALES', 'mm9p02mlk0i5ysy'),
  attempts: getEnv('VITE_TABLE_ATTEMPTS', 'mqdlglkwjvvtplc')
};

export const NOCODB_CONFIG = {
  // URL del API - en Vercel es el mismo dominio
  // El frontend detectará automáticamente la URL del servidor
  PROXY_URL: '',

  // URL de NocoDB para conexión directa (solo en desarrollo)
  BASE_URL: NOCODB_URL,

  // Token para conexión directa (solo en desarrollo)
  TOKEN: NOCODB_TOKEN,

  // Indica si estamos en modo desarrollo local
  IS_DEV: isDev,

  // Indica si tenemos credenciales para conexión directa
  HAS_DIRECT_CREDENTIALS: !!NOCODB_TOKEN,

  // Indica si debemos usar el proxy de Vite en desarrollo
  // Esto es necesario cuando el navegador no puede resolver DNS para app.nocodb.com
  // El proxy de Vite inyecta el token xc-token desde el servidor
  // ⚠️ CORS bloquea la conexión directa desde el navegador
  USE_VITE_PROXY: isDev,

  // Debug mode - desactivado por defecto para evitar spam en consola
  // Cambiar a true solo cuando se necesite depurar
  DEBUG: false
};

// Helper para saber si el API está configurada
// - En producción de Vercel: siempre está configurado (usa el proxy)
// - En desarrollo local: necesita VITE_NOCODB_TOKEN para conectar directamente
export const isApiConfigured = () => {
  if (isDev) {
    // En desarrollo, verificar si hay token configurado para conexión directa
    return !!NOCODB_TOKEN;
  }
  return true; // En producción usamos la API via proxy
};
