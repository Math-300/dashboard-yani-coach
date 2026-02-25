/**
 * Servicio de Caché para datos del Dashboard
 * 
 * Implementa el patrón SWR (Stale-While-Revalidate):
 * 1. Devuelve datos en caché inmediatamente si existen
 * 2. Revalida en background para mantener datos frescos
 * 3. 🚀 NUEVO: Filtrado en el servidor (server-side filtering)
 */

import React from 'react';
import { Seller, Contact, Interaction, Sale, PurchaseAttempt } from '../types';
import { getRealSellers, getRealSales, getRealContacts, getRealInteractions, getRealAttempts, getRealContactsByStatus, DateRange } from './noco';
import { isApiConfigured, NOCODB_CONFIG } from '../config';

// Tipos para el caché
export interface CachedData {
    sellers: Seller[];
    contacts: Contact[]; // Contactos filtrados por fecha
    allContacts: Contact[]; // 🚀 NUEVO: TODOS los contactos (sin filtro) para embudo y pipeline
    interactions: Interaction[];
    sales: Sale[];
    attempts: PurchaseAttempt[];
    timestamp: number;
    isDemo: boolean;
    dateRange?: DateRange | null; // 🚀 NUEVO: Rango de fechas usado para filtrar en servidor
}

interface CacheState {
    data: CachedData | null;
    isLoading: boolean;
    error: Error | null;
    lastFetch: number | null;
    isNetworkError: boolean; // Nuevo: indica si es error de red
    currentDateRange?: DateRange | null; // 🚀 NUEVO: Rango de fechas actual
}

// Configuración del caché
const CACHE_CONFIG = {
    // Tiempo de vida del caché en ms (5 minutos)
    STALE_TIME: 5 * 60 * 1000,
    // Tiempo máximo antes de forzar recarga (30 minutos)
    MAX_AGE: 30 * 60 * 1000,
    // Intervalo de revalidación en background (5 minutos)
    REVALIDATE_INTERVAL: 5 * 60 * 1000,
    // Timeout para peticiones individuales (10 segundos es suficiente con filtrado server-side)
    REQUEST_TIMEOUT: 10 * 1000,
};

// Estado global del caché
let cacheState: CacheState = {
    data: null,
    isLoading: false,
    error: null,
    lastFetch: null,
    isNetworkError: false,
};

// Suscriptores para notificar cambios
type Subscriber = (state: CacheState) => void;
const subscribers: Set<Subscriber> = new Set();

// Función para notificar a suscriptores
const notifySubscribers = () => {
    subscribers.forEach(callback => callback(cacheState));
};

// Función para suscribirse a cambios
export const subscribe = (callback: Subscriber) => {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
};

// Obtener estado actual
export const getCacheState = () => cacheState;

/**
 * Helper para detectar errores de red
 */
const isNetworkError = (error: unknown): boolean => {
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return (
            message.includes('network') ||
            message.includes('timeout') ||
            message.includes('timed_out') ||
            message.includes('err_internet_disconnected') ||
            message.includes('err_connection') ||
            message.includes('failed to fetch') ||
            message.includes('networkerror') ||
            message.includes('abort')
        );
    }
    return false;
};

/**
 * Helper para crear promesas con timeout
 */
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout: La petición tardó más de ${timeoutMs / 1000} segundos`));
        }, timeoutMs);

        promise
            .then((result) => {
                clearTimeout(timeoutId);
                resolve(result);
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
};

/**
 * Carga todos los datos desde NocoDB con filtrado en el servidor
 * 
 * 🚀 SERVER-SIDE FILTERING: Pasa el dateRange a NocoDB para filtrar
 * los registros en el servidor, reduciendo drásticamente el tiempo
 * de carga y evitando timeouts con grandes volúmenes de datos.
 * 
 * @param dateRange - Rango de fechas para filtrar en el servidor
 */
async function fetchAllData(dateRange?: DateRange | null): Promise<CachedData> {
    const isDemo = !isApiConfigured();

    if (isDemo) {
        // Retornar datos vacíos si no hay API configurada
        // El componente App.tsx manejará el estado demo
        return {
            sellers: [],
            contacts: [],
            allContacts: [], // 🚀 NUEVO: Todos los contactos para embudo y pipeline
            interactions: [],
            sales: [],
            attempts: [],
            timestamp: Date.now(),
            isDemo: true,
            dateRange: dateRange || null,
        };
    }

    // Carga secuencial con delays para evitar rate limiting
    // Sin delay cuando hay filtrado server-side (datos pequeños)
    // Delay pequeño solo en carga inicial sin filtro
    const DELAY_BETWEEN_REQUESTS = dateRange ? 0 : 50;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    if (NOCODB_CONFIG.DEBUG && dateRange) {
        const startStr = dateRange.start.toISOString().split('T')[0];
        const endStr = dateRange.end.toISOString().split('T')[0];
        console.log(`[Cache] Filtrando en servidor: ${startStr} a ${endStr}`);
    }

    // Cargar datos con timeout individual para cada petición
    // 🚀 NUEVO: Pasar dateRange para filtrado en el servidor
    // Las vendedoras (sellers) no se filtran por fecha
    const sellers = await withTimeout(getRealSellers(), CACHE_CONFIG.REQUEST_TIMEOUT);
    await delay(DELAY_BETWEEN_REQUESTS);

    // Estas tablas sí se filtran por fecha en el servidor
    const sales = await withTimeout(getRealSales(dateRange), CACHE_CONFIG.REQUEST_TIMEOUT);
    await delay(DELAY_BETWEEN_REQUESTS);

    const contacts = await withTimeout(getRealContacts(dateRange), CACHE_CONFIG.REQUEST_TIMEOUT);
    await delay(DELAY_BETWEEN_REQUESTS);

    // 🚀 NUEVO: Cargar contactos con estados relevantes para el embudo
    // Solo cargamos los estados que importan para el embudo de ventas:
    // - Venta Ganada (ventas cerradas)
    // - Venta Perdida (ventas perdidas)
    // - Interesado (potencial venta agendada)
    // - En Seguimiento (contactados)
    // - Nuevo (leads nuevos)
    // Esto reduce drásticamente la cantidad de datos a cargar vs. todos los contactos
    const funnelStatuses = [
        // Estados reales en NocoDB (Contactos → Estado Actual)
        'Lead Nuevo',
        'En Seguimiento 24 hs después primer contacto',
        'En Seguimiento 7 días',
        'Llamada Agendada',
        'Seguimiento Cliente Nuevo',
        'Seguimiento venta perdida',
        'Seguimiento leads sin respuesta',
        'Seguimiento Potencial venta',
        'Contactar en 48 horas',
        'Nutrición a Largo Plazo',
        'No se presentó',
        'Venta Ganada',
        'Venta Perdida',
        'Leads perdidos (que nunca contestaron)',
        'no contactar'
    ];

    let allContacts: Contact[] = contacts; // Por defecto usar contactos filtrados
    try {
        // Usar un timeout más largo para cargar contactos del embudo
        const funnelContacts = await withTimeout(
            getRealContactsByStatus(funnelStatuses),
            CACHE_CONFIG.REQUEST_TIMEOUT * 3 // 30 segundos
        );
        if (funnelContacts.length > 0) {
            allContacts = funnelContacts;
        }
        if (NOCODB_CONFIG.DEBUG) {
            console.log('[Cache] Contactos del embudo cargados:', allContacts.length);
        }
    } catch (error) {
        console.warn('[Cache] No se pudieron cargar contactos del embudo, usando contactos filtrados:', error);
        // allContacts ya tiene el valor de contacts como fallback
    }
    await delay(DELAY_BETWEEN_REQUESTS);

    const interactions = await withTimeout(getRealInteractions(dateRange), CACHE_CONFIG.REQUEST_TIMEOUT);
    await delay(DELAY_BETWEEN_REQUESTS);

    const attempts = await withTimeout(getRealAttempts(dateRange), CACHE_CONFIG.REQUEST_TIMEOUT);

    if (NOCODB_CONFIG.DEBUG) {
        console.log('[Cache] Datos cargados con filtro de servidor:', {
            sellers: sellers.length,
            contacts: contacts.length,
            allContacts: allContacts.length,
            interactions: interactions.length,
            sales: sales.length,
            attempts: attempts.length,
            dateRange: dateRange ? `${dateRange.start.toISOString().split('T')[0]} - ${dateRange.end.toISOString().split('T')[0]}` : 'sin filtro'
        });
    }

    return {
        sellers,
        contacts,
        allContacts, // 🚀 NUEVO: Todos los contactos para embudo y pipeline
        interactions,
        sales,
        attempts,
        timestamp: Date.now(),
        isDemo: false,
        dateRange: dateRange || null,
    };
}

/**
 * Fuerza la recarga de datos (invalida caché)
 * 
 * @param dateRange - Rango de fechas para filtrar en el servidor
 */
export const invalidateCache = async (dateRange?: DateRange | null) => {
    cacheState = {
        ...cacheState,
        isLoading: true,
        error: null,
        isNetworkError: false,
        currentDateRange: dateRange || null,
    };
    notifySubscribers();

    try {
        const data = await withTimeout(fetchAllData(dateRange), CACHE_CONFIG.REQUEST_TIMEOUT * 5);
        cacheState = {
            data,
            isLoading: false,
            error: null,
            lastFetch: Date.now(),
            isNetworkError: false,
            currentDateRange: dateRange || null,
        };
    } catch (error) {
        const networkError = isNetworkError(error);
        cacheState = {
            ...cacheState,
            isLoading: false,
            error: error instanceof Error ? error : new Error('Error desconocido'),
            isNetworkError: networkError,
        };
    }

    notifySubscribers();
};

/**
 * Obtiene datos del caché o los carga si es necesario
 * Implementa SWR: devuelve stale data mientras revalida
 * 
 * @param forceRefresh - Forzar recarga ignorando caché
 * @param dateRange - Rango de fechas para filtrar en el servidor
 */
export const getData = async (forceRefresh = false, dateRange?: DateRange | null): Promise<CachedData | null> => {
    const now = Date.now();

    // 🚀 NUEVO: Verificar si el dateRange cambió
    const dateRangeChanged = cacheState.currentDateRange !== undefined &&
        dateRange !== undefined &&
        !datesEqual(cacheState.currentDateRange, dateRange);

    // Si el dateRange cambió, forzar recarga
    if (dateRangeChanged) {
        if (NOCODB_CONFIG.DEBUG) {
            console.log('[Cache] DateRange cambió, forzando recarga con nuevo filtro');
        }
        await invalidateCache(dateRange);
        return cacheState.data;
    }

    // Si hay datos en caché y no están muy viejos, devolver inmediatamente
    if (cacheState.data && !forceRefresh) {
        const age = now - cacheState.data.timestamp;

        // Datos frescos: devolver sin revalidar
        if (age < CACHE_CONFIG.STALE_TIME) {
            return cacheState.data;
        }

        // Datos stale pero no muy viejos: devolver y revalidar en background
        if (age < CACHE_CONFIG.MAX_AGE) {
            // Revalidar en background (no await)
            revalidateInBackground(dateRange);
            return cacheState.data;
        }
    }

    // No hay datos o están muy viejos: cargar sincrónicamente
    if (!cacheState.isLoading) {
        await invalidateCache(dateRange);
    }

    return cacheState.data;
};

/**
 * Helper para comparar si dos dateRanges son iguales
 */
const datesEqual = (a: DateRange | null | undefined, b: DateRange | null | undefined): boolean => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();
};

/**
 * Revalidación en background (no bloquea la UI)
 * 
 * @param dateRange - Rango de fechas para filtrar en el servidor
 */
let revalidationPromise: Promise<void> | null = null;

const revalidateInBackground = async (dateRange?: DateRange | null) => {
    // Evitar múltiples revalidaciones simultáneas
    if (revalidationPromise) return;

    revalidationPromise = (async () => {
        try {
            if (NOCODB_CONFIG.DEBUG) {
                console.log('[Cache] Revalidando en background...');
            }

            const data = await fetchAllData(dateRange);
            cacheState = {
                data,
                isLoading: false,
                error: null,
                lastFetch: Date.now(),
                isNetworkError: false,
                currentDateRange: dateRange || null,
            };
            notifySubscribers();
        } catch (error) {
            if (NOCODB_CONFIG.DEBUG) {
                console.error('[Cache] Error en revalidación:', error);
            }
        } finally {
            revalidationPromise = null;
        }
    })();
};

/**
 * Compara dos fechas solo por día (ignora horas, minutos, segundos)
 * Esto evita problemas de timezone donde los timestamps pueden diferir
 * pero representan el mismo día calendario.
 */
const isSameCalendarDay = (date1: Date, date2: Date): boolean => {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
};

/**
 * Compara dos rangos de fechas por días calendario (no por timestamps exactos)
 */
const isSameDateRange = (range1: DateRange | null | undefined, range2: { start: Date; end: Date }): boolean => {
    if (!range1) return false;
    return isSameCalendarDay(range1.start, range2.start) && isSameCalendarDay(range1.end, range2.end);
};

/**
 * Filtra datos por rango de fechas (en el cliente)
 * 
 * NOTA: Si los datos ya vienen filtrados del servidor (tienen dateRange),
 * NO se vuelve a filtrar para evitar procesamiento redundante.
 */
export const filterByDateRange = (
    data: CachedData,
    startDate: Date,
    endDate: Date
): {
    contacts: Contact[];
    interactions: Interaction[];
    sales: Sale[];
    attempts: PurchaseAttempt[];
} => {
    // 🚀 OPTIMIZACIÓN: Si los datos ya están filtrados por el servidor con el mismo rango,
    // devolverlos directamente sin volver a filtrar
    // ✅ CORREGIDO: Usar comparación por día calendario en lugar de timestamps exactos
    if (isSameDateRange(data.dateRange, { start: startDate, end: endDate })) {
        if (NOCODB_CONFIG.DEBUG) {
            console.log('[Cache] Usando datos del servidor sin re-filtrar (mismo rango de fechas)');
        }
        return {
            contacts: data.contacts,
            interactions: data.interactions,
            sales: data.sales,
            attempts: data.attempts,
        };
    }

    // Solo filtrar en cliente si hay discrepancia entre el rango solicitado y el del caché
    if (NOCODB_CONFIG.DEBUG) {
        console.log('[Cache] Filtrando datos en cliente (rango diferente)', {
            cacheRange: data.dateRange
                ? `${data.dateRange.start.toLocaleDateString('es-CO')} - ${data.dateRange.end.toLocaleDateString('es-CO')}`
                : 'sin rango',
            requestedRange: `${startDate.toLocaleDateString('es-CO')} - ${endDate.toLocaleDateString('es-CO')}`
        });
    }

    // ✅ CORREGIDO: Usar comparación que considera timezone local
    // Las fechas de NocoDB vienen en UTC, necesitamos comparar en hora local
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    const isWithinRange = (dateString: string): boolean => {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return false;
        const time = date.getTime();
        return time >= startMs && time <= endMs;
    };

    const result = {
        contacts: data.contacts.filter(c => isWithinRange(c.createdAt)),
        interactions: data.interactions.filter(i => isWithinRange(i.date)),
        sales: data.sales.filter(s => isWithinRange(s.date)),
        attempts: data.attempts.filter(a => isWithinRange(a.date)),
    };

    if (NOCODB_CONFIG.DEBUG) {
        console.log('[Cache] Resultado del filtrado cliente:', {
            contacts: `${result.contacts.length}/${data.contacts.length}`,
            interactions: `${result.interactions.length}/${data.interactions.length}`,
            sales: `${result.sales.length}/${data.sales.length}`,
            attempts: `${result.attempts.length}/${data.attempts.length}`
        });
    }

    return result;
};

/**
 * Hook para usar el caché en componentes React
 */
export const useCache = () => {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    React.useEffect(() => {
        const unsubscribe = subscribe(() => {
            forceUpdate();
        });
        return unsubscribe;
    }, []);

    return {
        ...cacheState,
        invalidateCache,
        getData,
        filterByDateRange,
    };
};
