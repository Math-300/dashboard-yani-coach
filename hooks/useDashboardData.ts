/**
 * Hook personalizado para manejar datos del Dashboard con caché integrado
 * 
 * Características:
 * - Carga datos una sola vez al iniciar
 * - 🚀 NUEVO: Filtrado por fecha en el servidor (server-side filtering)
 * - Revalidación automática en background
 * - Estado de carga y error manejados
 * - Timeout y detección de errores de red
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Contact, Interaction, Sale, PurchaseAttempt, Seller } from '../types';
import {
    getData,
    invalidateCache,
    filterByDateRange,
    subscribe,
    getCacheState,
    CachedData
} from '../services/cacheService';
import { DateRange } from '../services/noco';

interface UseDashboardDataResult {
    // Datos filtrados por fecha
    contacts: Contact[];
    interactions: Interaction[];
    sales: Sale[];
    attempts: PurchaseAttempt[];
    sellers: Seller[];

    // 🚀 NUEVO: Todos los contactos (sin filtro) para embudo y pipeline
    allContacts: Contact[];

    // Estados
    isLoading: boolean;
    isDemo: boolean;
    error: Error | null;
    isNetworkError: boolean; // Nuevo: indica si es error de red

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
    // Estado para datos filtrados
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

    // 🚀 NUEVO: Estado para TODOS los contactos (sin filtro de fecha)
    // Necesario para cálculos de embudo y pipeline que deben considerar todas las ventas
    const [allContacts, setAllContacts] = useState<Contact[]>([]);

    // Estado para sellers (no se filtran por fecha)
    const [sellers, setSellers] = useState<Seller[]>([]);

    // Estados de UI
    const [isDemo, setIsDemo] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isNetworkError, setIsNetworkError] = useState(false);

    // Ref para evitar actualizaciones si el componente se desmonta
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Función para cargar datos iniciales
    // 🚀 NUEVO: Pasa dateRange para filtrado en el servidor
    const loadInitialData = useCallback(async () => {
        try {
            // Crear DateRange para pasar al servidor
            const dateRange: DateRange = { start: startDate, end: endDate };

            // 🚀 SERVER-SIDE FILTERING: Pasar dateRange a getData
            const cachedData = await getData(false, dateRange);

            if (!mountedRef.current) return;

            if (cachedData) {
                setSellers(cachedData.sellers);
                setIsDemo(cachedData.isDemo);

                // 🚀 NUEVO: Cargar todos los contactos (sin filtro) para embudo y pipeline
                setAllContacts(cachedData.allContacts || []);

                // Los datos ya vienen filtrados del servidor, pero aplicamos
                // filtro adicional en el cliente por si hay diferencias de timezone
                const filtered = filterByDateRange(cachedData, startDate, endDate);
                setFilteredData(filtered);
                setIsInitialLoad(false);
                setIsNetworkError(false);
            }
        } catch (err) {
            if (mountedRef.current) {
                setError(err instanceof Error ? err : new Error('Error cargando datos'));
                setIsInitialLoad(false);
                // Verificar si es error de red desde el estado del caché
                const cacheState = getCacheState();
                setIsNetworkError(cacheState.isNetworkError);
            }
        }
    }, [startDate, endDate]);

    // Función para refrescar datos (fuerza recarga desde API)
    // 🚀 NUEVO: Pasa dateRange para filtrado en el servidor
    const refresh = useCallback(async () => {
        setIsInitialLoad(true);
        setError(null);
        setIsNetworkError(false);

        try {
            // Crear DateRange para pasar al servidor
            const dateRange: DateRange = { start: startDate, end: endDate };

            // 🚀 SERVER-SIDE FILTERING: Pasar dateRange a invalidateCache
            await invalidateCache(dateRange);
            const cachedData = getCacheState().data;

            if (cachedData && mountedRef.current) {
                setSellers(cachedData.sellers);
                setIsDemo(cachedData.isDemo);

                // 🚀 NUEVO: Cargar todos los contactos (sin filtro) para embudo y pipeline
                setAllContacts(cachedData.allContacts || []);

                const filtered = filterByDateRange(cachedData, startDate, endDate);
                setFilteredData(filtered);
            }
        } catch (err) {
            if (mountedRef.current) {
                setError(err instanceof Error ? err : new Error('Error refrescando datos'));
                // Verificar si es error de red desde el estado del caché
                const cacheState = getCacheState();
                setIsNetworkError(cacheState.isNetworkError);
            }
        } finally {
            if (mountedRef.current) {
                setIsInitialLoad(false);
            }
        }
    }, [startDate, endDate]);

    // Efecto 1: Cargar datos iniciales (solo una vez)
    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    // Efecto 2: Suscribirse a cambios del caché
    useEffect(() => {
        const unsubscribe = subscribe((state) => {
            if (!mountedRef.current) return;

            if (state.data) {
                setSellers(state.data.sellers);
                setIsDemo(state.data.isDemo);

                // 🚀 NUEVO: Actualizar todos los contactos
                setAllContacts(state.data.allContacts || []);

                const filtered = filterByDateRange(state.data, startDate, endDate);
                setFilteredData(filtered);
            }

            if (state.error) {
                setError(state.error);
                setIsNetworkError(state.isNetworkError);
            }
        });

        return unsubscribe;
    }, [startDate, endDate]);

    // Efecto 3: 🚀 NUEVO - Recargar datos cuando cambian las fechas (server-side filtering)
    // Cuando el usuario cambia el rango de fechas, necesitamos recargar los datos
    // desde el servidor con el nuevo filtro, en lugar de solo filtrar en el cliente.
    useEffect(() => {
        // Solo recargar si ya tenemos datos cargados (no en la carga inicial)
        if (!isInitialLoad) {
            const dateRange: DateRange = { start: startDate, end: endDate };
            invalidateCache(dateRange);
        }
    }, [startDate, endDate]);

    // Obtener estado de carga actual
    const cacheState = getCacheState();
    const isLoading = cacheState.isLoading && isInitialLoad;

    return {
        ...filteredData,
        sellers,
        allContacts, // 🚀 NUEVO: Todos los contactos para embudo y pipeline
        isLoading,
        isDemo,
        error,
        isNetworkError,
        refresh,
        isInitialLoad,
    };
}

export default useDashboardData;
