/**
 * Servicio de Caché para datos del Dashboard
 * 
 * Implementa el patrón SWR (Stale-While-Revalidate):
 * 1. Devuelve datos en caché inmediatamente si existen
 * 2. Revalida en background para mantener datos frescos
 * 
 * ⚡ OPTIMIZADO: Usa micro-fetching en lugar de descarga masiva.
 * Los conteos del embudo se obtienen vía fetchCount (1 req por estado).
 * Los registros individuales solo se descargan del rango seleccionado.
 */

import React from 'react';
import { Seller, Contact, Interaction, Sale, PurchaseAttempt, KpiCounts } from '../types';
import {
    getRealSellers, getRealSales, getRealContacts, getRealInteractions,
    getRealAttempts, getFunnelCounts, getInteractionCounts, getKpiCounts,
    DateRange, FunnelCounts
} from './noco';
import { isApiConfigured, NOCODB_CONFIG } from '../config';

// Tipos para el caché
export interface CachedData {
    sellers: Seller[];
    contacts: Contact[];
    funnelCounts: FunnelCounts;           // ⚡ Conteos por estado (sin descargar 27K registros)
    interactions: Interaction[];
    interactionCounts: Record<string, number>; // ⚡ Conteos por canal
    kpiCounts: KpiCounts;                 // ⚡ Conteos KPIs (micro-fetching)
    sales: Sale[];
    attempts: PurchaseAttempt[];
    timestamp: number;
    isDemo: boolean;
    dateRange?: DateRange | null;
}

interface CacheState {
    data: CachedData | null;
    isLoading: boolean;
    error: Error | null;
    lastFetch: number | null;
    isNetworkError: boolean;
    currentDateRange?: DateRange | null;
}

// Configuración del caché
const CACHE_CONFIG = {
    STALE_TIME: 5 * 60 * 1000,       // 5 minutos
    MAX_AGE: 30 * 60 * 1000,          // 30 minutos
    REVALIDATE_INTERVAL: 5 * 60 * 1000,
    REQUEST_TIMEOUT: 30 * 1000,       // 30 segundos por operación completa
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

const notifySubscribers = () => {
    subscribers.forEach(callback => callback(cacheState));
};

export const subscribe = (callback: Subscriber) => {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
};

export const getCacheState = () => cacheState;

/**
 * Helper para detectar errores de red
 */
const isNetworkError = (error: unknown): boolean => {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        return msg.includes('network') || msg.includes('timeout') || msg.includes('failed to fetch') || msg.includes('abort');
    }
    return false;
};

/**
 * Helper para crear promesas con timeout
 */
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    return new Promise((resolve, reject) => {
        const tid = setTimeout(() => reject(new Error(`Timeout: ${timeoutMs / 1000}s`)), timeoutMs);
        promise.then(r => { clearTimeout(tid); resolve(r); }).catch(e => { clearTimeout(tid); reject(e); });
    });
};

/**
 * ⚡ Carga todos los datos con micro-fetching.
 * 
 * Estrategia:
 * 1. Sellers (1 req) — con Rollups pre-calculados
 * 2. FunnelCounts (12-15 reqs) — conteos por estado vía limit=1
 * 3. Sales filtradas (1-2 reqs) — solo del rango seleccionado
 * 4. Contacts filtrados (1-2 reqs) — solo del rango seleccionado
 * 5. Interactions filtradas (1-2 reqs) — solo del rango seleccionado
 * 6. InteractionCounts (5 reqs) — conteos por canal
 * 7. Attempts filtrados (1 req) — solo del rango seleccionado
 * 
 * Total: ~25-30 requests (antes: ~386)
 */
async function fetchAllData(dateRange?: DateRange | null, existingData?: CachedData | null): Promise<CachedData> {
    const isDemo = !isApiConfigured();

    if (isDemo) {
        return {
            sellers: [],
            contacts: [],
            funnelCounts: {},
            interactions: [],
            interactionCounts: {},
            kpiCounts: {
                leadsCreated: 0,
                newLeads: 0,
                urgentFollowUps: 0,
                salesCount: 0
            },
            sales: [],
            attempts: [],
            timestamp: Date.now(),
            isDemo: true,
            dateRange: dateRange || null,
        };
    }

    if (NOCODB_CONFIG.DEBUG && dateRange) {
        console.log(`[Cache] Filtro: ${dateRange.start.toISOString().split('T')[0]} a ${dateRange.end.toISOString().split('T')[0]}`);
    }

    // ⚡ Paso 1: Sellers (reutilizar si ya los tenemos)
    let sellers: Seller[];
    if (existingData?.sellers && existingData.sellers.length > 0) {
        sellers = existingData.sellers;
        if (NOCODB_CONFIG.DEBUG) console.log('[Cache] Reutilizando sellers desde caché.');
    } else {
        sellers = await getRealSellers();
    }

    // ⚡ Paso 2: Conteos del embudo (reutilizar si el dateRange no cambió)
    // Los conteos del embudo son GLOBALES (no filtrados por fecha)
    let funnelCounts: FunnelCounts;
    if (existingData?.funnelCounts && Object.keys(existingData.funnelCounts).length > 0) {
        funnelCounts = existingData.funnelCounts;
        if (NOCODB_CONFIG.DEBUG) console.log('[Cache] Reutilizando conteos del embudo.');
    } else {
        funnelCounts = await getFunnelCounts();
    }

    // ⚡ Paso 3-8: Datos filtrados por fecha (en paralelo)
    const [sales, contacts, interactions, interactionCounts, attempts, kpiCounts] = await Promise.all([
        getRealSales(dateRange),
        getRealContacts(dateRange),
        getRealInteractions(dateRange),
        getInteractionCounts(dateRange),
        getRealAttempts(dateRange),
        getKpiCounts(dateRange),
    ]);

    if (NOCODB_CONFIG.DEBUG) {
        console.log('[Cache] Datos cargados (micro-fetching):', {
            sellers: sellers.length,
            funnelStates: Object.keys(funnelCounts).length,
            contacts: contacts.length,
            interactions: interactions.length,
            sales: sales.length,
            attempts: attempts.length,
            kpiCounts,
            dateRange: dateRange ? `${dateRange.start.toISOString().split('T')[0]} - ${dateRange.end.toISOString().split('T')[0]}` : 'sin filtro'
        });
    }

    return {
        sellers,
        contacts,
        funnelCounts,
        interactions,
        interactionCounts,
        kpiCounts,
        sales,
        attempts,
        timestamp: Date.now(),
        isDemo: false,
        dateRange: dateRange || null,
    };
}

/**
 * Fuerza la recarga de datos
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
        const data = await withTimeout(fetchAllData(dateRange, cacheState.data), CACHE_CONFIG.REQUEST_TIMEOUT * 3);
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
 */
export const getData = async (forceRefresh = false, dateRange?: DateRange | null): Promise<CachedData | null> => {
    const now = Date.now();

    const dateRangeChanged = cacheState.currentDateRange !== undefined &&
        dateRange !== undefined &&
        !datesEqual(cacheState.currentDateRange, dateRange);

    if (dateRangeChanged) {
        if (NOCODB_CONFIG.DEBUG) console.log('[Cache] DateRange cambió, recargando con nuevo filtro');
        await invalidateCache(dateRange);
        return cacheState.data;
    }

    if (cacheState.data && !forceRefresh) {
        const age = now - cacheState.data.timestamp;
        if (age < CACHE_CONFIG.STALE_TIME) return cacheState.data;
        if (age < CACHE_CONFIG.MAX_AGE) {
            revalidateInBackground(dateRange);
            return cacheState.data;
        }
    }

    if (!cacheState.isLoading) {
        await invalidateCache(dateRange);
    }
    return cacheState.data;
};

const datesEqual = (a: DateRange | null | undefined, b: DateRange | null | undefined): boolean => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();
};

let revalidationPromise: Promise<void> | null = null;

const revalidateInBackground = async (dateRange?: DateRange | null) => {
    if (revalidationPromise) return;
    revalidationPromise = (async () => {
        try {
            if (NOCODB_CONFIG.DEBUG) console.log('[Cache] Revalidando en background...');
            const data = await fetchAllData(dateRange, cacheState.data);
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
            if (NOCODB_CONFIG.DEBUG) console.error('[Cache] Error en revalidación:', error);
        } finally {
            revalidationPromise = null;
        }
    })();
};

/**
 * Filtra datos por rango de fechas (en el cliente)
 * Con micro-fetching, los datos ya vienen filtrados del servidor la mayoría del tiempo.
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
    // Si los datos ya vienen filtrados por el servidor con el mismo rango, devolver directo
    if (data.dateRange && isSameDateRange(data.dateRange, { start: startDate, end: endDate })) {
        return {
            contacts: data.contacts,
            interactions: data.interactions,
            sales: data.sales,
            attempts: data.attempts,
        };
    }

    // Filtrado en cliente como fallback
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    const inRange = (ds: string): boolean => {
        const t = new Date(ds).getTime();
        return !isNaN(t) && t >= startMs && t <= endMs;
    };

    return {
        contacts: data.contacts.filter(c => inRange(c.createdAt)),
        interactions: data.interactions.filter(i => inRange(i.date)),
        sales: data.sales.filter(s => inRange(s.date)),
        attempts: data.attempts.filter(a => inRange(a.date)),
    };
};

const isSameDateRange = (r1: DateRange, r2: { start: Date; end: Date }): boolean => {
    const d1s = r1.start, d1e = r1.end, d2s = r2.start, d2e = r2.end;
    return d1s.getFullYear() === d2s.getFullYear() && d1s.getMonth() === d2s.getMonth() && d1s.getDate() === d2s.getDate()
        && d1e.getFullYear() === d2e.getFullYear() && d1e.getMonth() === d2e.getMonth() && d1e.getDate() === d2e.getDate();
};

/**
 * Hook para usar el caché en componentes React
 */
export const useCache = () => {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    React.useEffect(() => {
        const unsubscribe = subscribe(() => forceUpdate());
        return unsubscribe;
    }, []);
    return { ...cacheState, invalidateCache, getData, filterByDateRange };
};
