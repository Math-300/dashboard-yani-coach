/**
 * Hook personalizado para manejar datos del Dashboard con caché integrado
 * 
 * ⚡ OPTIMIZADO: Usa micro-fetching.
 * - Carga datos una sola vez al iniciar
 * - Filtrado por fecha en el servidor
 * - Revalidación automática en background
 * - Expone funnelCounts (conteos por estado) en lugar de 27K registros
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Contact, Interaction, Sale, PurchaseAttempt, Seller, KpiCounts } from '../types';
import {
    getData,
    invalidateCache,
    filterByDateRange,
    subscribe,
    getCacheState,
    CachedData
} from '../services/cacheService';
import { DateRange, FunnelCounts } from '../services/noco';

interface UseDashboardDataResult {
    // Datos filtrados por fecha
    contacts: Contact[];
    interactions: Interaction[];
    sales: Sale[];
    attempts: PurchaseAttempt[];
    sellers: Seller[];

    // ⚡ Conteos pre-calculados (sin descargar 27K registros)
    funnelCounts: FunnelCounts;
    interactionCounts: Record<string, number>;
    kpiCounts: KpiCounts;

    // Estados
    isLoading: boolean;
    isDemo: boolean;
    error: Error | null;
    isNetworkError: boolean;

    // Acciones
    refresh: () => Promise<void>;
    isInitialLoad: boolean;
}

/**
 * Hook para obtener y filtrar datos del dashboard
 * @param startDate - Fecha de inicio del filtro
 * @param endDate - Fecha de fin del filtro
 */
export function useDashboardData(
    startDate: Date,
    endDate: Date
): UseDashboardDataResult {
    const [filteredData, setFilteredData] = useState<{
        contacts: Contact[];
        interactions: Interaction[];
        sales: Sale[];
        attempts: PurchaseAttempt[];
    }>({
        contacts: [],
        interactions: [],
        sales: [],
        attempts: [],
    });

    const [sellers, setSellers] = useState<Seller[]>([]);
    const [funnelCounts, setFunnelCounts] = useState<FunnelCounts>({});
    const [interactionCounts, setInteractionCounts] = useState<Record<string, number>>({});
    const [kpiCounts, setKpiCounts] = useState<KpiCounts>({
        leadsCreated: 0,
        newLeads: 0,
        urgentFollowUps: 0,
        salesCount: 0
    });
    const [isDemo, setIsDemo] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isNetworkError, setIsNetworkError] = useState(false);

    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const applyDataToState = useCallback((cachedData: CachedData) => {
        setSellers(cachedData.sellers);
        setIsDemo(cachedData.isDemo);
        setFunnelCounts(cachedData.funnelCounts || {});
        setInteractionCounts(cachedData.interactionCounts || {});
        setKpiCounts(cachedData.kpiCounts || {
            leadsCreated: 0,
            newLeads: 0,
            urgentFollowUps: 0,
            salesCount: 0
        });

        const filtered = filterByDateRange(cachedData, startDate, endDate);
        setFilteredData(filtered);
    }, [startDate, endDate]);

    // Carga inicial
    const loadInitialData = useCallback(async () => {
        try {
            const dateRange: DateRange = { start: startDate, end: endDate };
            const cachedData = await getData(false, dateRange);
            if (!mountedRef.current) return;

            if (cachedData) {
                applyDataToState(cachedData);
                setIsInitialLoad(false);
                setIsNetworkError(false);
            }
        } catch (err) {
            if (mountedRef.current) {
                setError(err instanceof Error ? err : new Error('Error cargando datos'));
                setIsInitialLoad(false);
                setIsNetworkError(getCacheState().isNetworkError);
            }
        }
    }, [startDate, endDate, applyDataToState]);

    // Refresh manual
    const refresh = useCallback(async () => {
        setIsInitialLoad(true);
        setError(null);
        setIsNetworkError(false);

        try {
            const dateRange: DateRange = { start: startDate, end: endDate };
            await invalidateCache(dateRange);
            const cachedData = getCacheState().data;

            if (cachedData && mountedRef.current) {
                applyDataToState(cachedData);
            }
        } catch (err) {
            if (mountedRef.current) {
                setError(err instanceof Error ? err : new Error('Error refrescando datos'));
                setIsNetworkError(getCacheState().isNetworkError);
            }
        } finally {
            if (mountedRef.current) setIsInitialLoad(false);
        }
    }, [startDate, endDate, applyDataToState]);

    // Effect 1: Carga inicial
    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    // Effect 2: Suscripción al caché
    useEffect(() => {
        const unsubscribe = subscribe((state) => {
            if (!mountedRef.current) return;
            if (state.data) {
                applyDataToState(state.data);
            }
            if (state.error) {
                setError(state.error);
                setIsNetworkError(state.isNetworkError);
            }
        });
        return unsubscribe;
    }, [applyDataToState]);

    // Effect 3: Recarga cuando cambian las fechas
    useEffect(() => {
        if (!isInitialLoad) {
            const dateRange: DateRange = { start: startDate, end: endDate };
            invalidateCache(dateRange);
        }
    }, [startDate, endDate]);

    const cacheState = getCacheState();
    const isLoading = cacheState.isLoading && isInitialLoad;

    return {
        ...filteredData,
        sellers,
        funnelCounts,
        interactionCounts,
        kpiCounts,
        isLoading,
        isDemo,
        error,
        isNetworkError,
        refresh,
        isInitialLoad,
    };
}

export default useDashboardData;
