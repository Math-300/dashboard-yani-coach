/**
 * Hook personalizado para manejar datos del Dashboard con caché integrado
 *
 * - Carga datos una sola vez al montar y re-carga al cambiar el rango de fechas
 * - Dedup para el double-mount de React StrictMode (loadingRef por key de rango)
 * - Filtrado por fecha en el servidor; conteos pre-calculados
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
import { DateRange, FunnelCounts } from '../services/types';

interface UseDashboardDataResult {
    contacts: Contact[];
    interactions: Interaction[];
    sales: Sale[];
    attempts: PurchaseAttempt[];
    sellers: Seller[];

    funnelCounts: FunnelCounts;
    interactionCounts: Record<string, number>;
    kpiCounts: KpiCounts;

    isLoading: boolean;
    error: Error | null;

    refresh: () => Promise<void>;
    isInitialLoad: boolean;
}

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
    const [error, setError] = useState<Error | null>(null);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const mountedRef = useRef(true);
    const loadingRef = useRef<{ key: string; promise: Promise<void> } | null>(null);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const applyDataToState = useCallback((cachedData: CachedData) => {
        if (!mountedRef.current) return;
        setSellers(cachedData.sellers);
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

    const refresh = useCallback(async () => {
        if (!mountedRef.current) return;
        setIsInitialLoad(true);
        setError(null);

        try {
            const dateRange: DateRange = { start: startDate, end: endDate };
            await invalidateCache(dateRange);
            const cachedData = getCacheState().data;

            if (cachedData && mountedRef.current) {
                applyDataToState(cachedData);
            }
        } catch (err) {
            if (mountedRef.current) {
                const e = err instanceof Error ? err : new Error('Error refrescando datos');
                console.error('[Dashboard] Fallo refrescando datos:', e);
                setError(e);
            }
        } finally {
            if (mountedRef.current) setIsInitialLoad(false);
        }
    }, [startDate, endDate, applyDataToState]);

    // Effect principal: carga al montar y re-carga al cambiar fechas, dedupeado
    useEffect(() => {
        const key = `${startDate.getTime()}-${endDate.getTime()}`;

        // StrictMode / re-render rápido con la misma key: reutilizar la promesa
        if (loadingRef.current?.key === key) return;

        if (mountedRef.current) {
            setIsInitialLoad(true);
            setError(null);
        }

        const promise = (async () => {
            try {
                const dateRange: DateRange = { start: startDate, end: endDate };
                const cachedData = await getData(false, dateRange);
                if (!mountedRef.current) return;
                if (cachedData) applyDataToState(cachedData);
            } catch (err) {
                if (!mountedRef.current) return;
                const e = err instanceof Error ? err : new Error('Error cargando datos');
                console.error('[Dashboard] Fallo cargando datos:', e);
                setError(e);
            } finally {
                if (mountedRef.current) setIsInitialLoad(false);
                if (loadingRef.current?.key === key) loadingRef.current = null;
            }
        })();

        loadingRef.current = { key, promise };
    }, [startDate, endDate, applyDataToState]);

    // Effect: suscripción al caché para revalidaciones en background
    useEffect(() => {
        const unsubscribe = subscribe((state) => {
            if (!mountedRef.current) return;
            if (state.data) applyDataToState(state.data);
            if (state.error) {
                console.error('[Dashboard] Error en caché:', state.error);
                setError(state.error);
            }
        });
        return unsubscribe;
    }, [applyDataToState]);

    const cacheState = getCacheState();
    const isLoading = cacheState.isLoading && isInitialLoad;

    return {
        ...filteredData,
        sellers,
        funnelCounts,
        interactionCounts,
        kpiCounts,
        isLoading,
        error,
        refresh,
        isInitialLoad,
    };
}

export default useDashboardData;
