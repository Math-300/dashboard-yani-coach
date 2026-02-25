/**
 * Servicio de Cálculo de Métricas para el Dashboard de Yani Coach
 * 
 * Este módulo contiene todas las funciones de cálculo de KPIs y métricas
 * utilizadas en el Resumen Ejecutivo y otras vistas del dashboard.
 */

import {
    Contact,
    Sale,
    LeadStatus,
    DateRange,
    Interaction,
    Seller,
    PurchaseAttempt,
    PurchaseAttemptStatus,
    VendorPerformance,
    VendorInteractions,
    VendorConversion,
    VendorClosingTime,
    VendorLeads,
    VendorFollowUps,
    StatusDistribution,
    LostReasonAnalysis,
    SourceDistribution,
    CountryDistribution,
    ChannelDistribution,
    ResultDistribution,
    AttemptStatusDistribution,
    RecoveryMetrics,
    VendorRecovery,
    AttemptTrendData
} from '../types';

/**
 * Interfaz para el resultado del cálculo de ventas mensuales
 */
export interface MonthlySalesResult {
    count: number;        // Cantidad de ventas
    totalAmount: number;  // Monto total en COP
}

/**
 * Interfaz para el resultado del embudo de ventas
 */
export interface FunnelStep {
    status: string;       // Nombre del estado
    count: number;        // Cantidad de leads en este estado
    percentage: number;   // Porcentaje del total
}

/**
 * Calcula el total de contactos en el pipeline (excluyendo ventas cerradas ganadas/perdidas)
 * 
 * @param contacts - Lista de contactos
 * @returns Número total de contactos activos en el pipeline
 * 
 * @example
 * const contacts = [{ status: LeadStatus.NEW }, { status: LeadStatus.CONTACTED }];
 * calculateTotalLeadsInPipeline(contacts); // Returns: 2
 */
export const calculateTotalLeadsInPipeline = (contacts: Contact[]): number => {
    // Un contacto está en el pipeline si no está cerrado (ganado o perdido)
    const activeStatuses = [
        LeadStatus.NEW,
        LeadStatus.CONTACTED,
        LeadStatus.INTERESTED
    ];

    return contacts.filter(contact =>
        activeStatuses.includes(contact.status)
    ).length;
};

/**
 * Calcula la cantidad de leads nuevos en el período
 * 
 * @param contacts - Lista de contactos (ya filtrados por el servidor)
 * @param dateRange - Rango de fechas opcional
 * @returns Número de leads con Estado = "Lead Nuevo"
 * 
 * @example
 * // Si hay 3 contactos con estado "Nuevo"
 * calculateNewLeadsToday(contacts); // Returns: 3
 */
export const calculateNewLeadsToday = (
    contacts: Contact[],
    dateRange?: { start: Date; end: Date }
): number => {
    // ✅ CORREGIDO: Si hay dateRange, los datos YA vienen filtrados del servidor
    // Simplemente contar los contactos con estado "Nuevo"
    if (dateRange) {
        return contacts.filter(contact => contact.status === LeadStatus.NEW).length;
    }

    // Solo filtrar por fecha si NO hay dateRange (usar día de hoy por defecto)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    return contacts.filter(contact => {
        // Verificar que el estado sea "Nuevo"
        if (contact.status !== LeadStatus.NEW) return false;

        // Verificar que fue creado hoy
        const createdAt = new Date(contact.createdAt);
        return createdAt >= today && createdAt <= endOfToday;
    }).length;
};

/**
 * Calcula las ventas del mes actual o de un rango de fechas específico
 * 
 * @param sales - Lista de ventas
 * @param dateRange - Rango de fechas (opcional, si no se proporciona usa el mes actual)
 * @returns Objeto con cantidad de ventas y monto total
 * 
 * @example
 * const result = calculateMonthlySales(sales, { start: new Date('2026-02-01'), end: new Date('2026-02-28') });
 * console.log(result); // { count: 15, totalAmount: 2500000 }
 */
/**
 * Compara si una fecha (ISO string de NocoDB en UTC) está dentro de un rango de fechas local.
 * 
 * IMPORTANTE: Las fechas de NocoDB vienen en formato UTC (ej: "2026-02-23T00:00:00.000Z").
 * Esta función compara por DÍA CALENDARIO en hora local, no por timestamp exacto.
 * 
 * @param dateISOString - Fecha en formato ISO string (UTC)
 * @param localStart - Fecha de inicio en hora local
 * @param localEnd - Fecha de fin en hora local
 * @returns true si la fecha está dentro del rango (comparando por día calendario)
 */
const isDateInLocalRange = (
    dateISOString: string,
    localStart: Date,
    localEnd: Date
): boolean => {
    const date = new Date(dateISOString);
    if (isNaN(date.getTime())) return false;

    // Obtener componentes de fecha en hora LOCAL del navegador
    const dateYear = date.getFullYear();
    const dateMonth = date.getMonth();
    const dateDay = date.getDate();

    // Obtener componentes del rango en hora local
    const startYear = localStart.getFullYear();
    const startMonth = localStart.getMonth();
    const startDay = localStart.getDate();

    const endYear = localEnd.getFullYear();
    const endMonth = localEnd.getMonth();
    const endDay = localEnd.getDate();

    // Crear fechas comparables (solo día calendario)
    const dateOnly = dateYear * 10000 + dateMonth * 100 + dateDay;
    const startOnly = startYear * 10000 + startMonth * 100 + startDay;
    const endOnly = endYear * 10000 + endMonth * 100 + endDay;

    return dateOnly >= startOnly && dateOnly <= endOnly;
};

export const calculateMonthlySales = (
    sales: Sale[],
    dateRange?: { start: Date; end: Date }
): MonthlySalesResult => {
    // ✅ CORREGIDO: Si hay dateRange, asumimos que los datos YA vienen filtrados del servidor
    // No volvemos a filtrar para evitar problemas de timezone
    // Simplemente contamos todas las ventas que llegan
    if (dateRange) {
        return {
            count: sales.length,
            totalAmount: sales.reduce((sum, sale) => sum + (sale.amount || 0), 0)
        };
    }

    // Solo filtrar si NO hay dateRange (usar mes actual por defecto)
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);

    const filteredSales = sales.filter(sale => {
        return isDateInLocalRange(sale.date, start, end);
    });

    return {
        count: filteredSales.length,
        totalAmount: filteredSales.reduce((sum, sale) => sum + (sale.amount || 0), 0)
    };
};

/**
 * Calcula la tasa de conversión del pipeline
 * Fórmula: (Ganados / (Ganados + Perdidos)) × 100
 * 
 * @param contacts - Lista de contactos (ya filtrados por el servidor si hay dateRange)
 * @param dateRange - Rango de fechas opcional (solo para indicar que datos vienen filtrados)
 * @returns Porcentaje de conversión (0-100)
 * 
 * @example
 * // Si hay 20 ganados y 5 perdidos
 * calculateConversionRate(contacts); // Returns: 80 (80%)
 */
export const calculateConversionRate = (
    contacts: Contact[],
    dateRange?: { start: Date; end: Date }
): number => {
    // ✅ CORREGIDO: Si hay dateRange, los datos YA vienen filtrados del servidor
    // No volvemos a filtrar para evitar problemas de timezone
    const contactsToAnalyze = dateRange ? contacts : contacts;

    const won = contactsToAnalyze.filter(c => c.status === LeadStatus.CLOSED_WON).length;
    const lost = contactsToAnalyze.filter(c => c.status === LeadStatus.CLOSED_LOST).length;

    const total = won + lost;

    if (total === 0) return 0;

    return Math.round((won / total) * 100);
};

/**
 * Calcula la cantidad de contactos que requieren seguimiento urgente hoy
 * Un contacto es urgente si su fecha de próximo contacto es hoy
 * 
 * @param contacts - Lista de contactos
 * @returns Número de contactos con seguimiento pendiente para hoy
 * 
 * @example
 * // Si hay 5 contactos con nextContactDate = hoy
 * calculateUrgentFollowUps(contacts); // Returns: 5
 */
export const calculateUrgentFollowUps = (contacts: Contact[]): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    return contacts.filter(contact => {
        // Solo contactos activos (no cerrados)
        if (contact.status === LeadStatus.CLOSED_WON ||
            contact.status === LeadStatus.CLOSED_LOST) {
            return false;
        }

        // Verificar si tiene fecha de próximo contacto
        if (!contact.nextContactDate) return false;

        const nextContact = new Date(contact.nextContactDate);
        return nextContact >= today && nextContact <= endOfToday;
    }).length;
};

/**
 * Calcula el valor total del pipeline (suma de EstimatedValue de leads activos)
 * 
 * @param contacts - Lista de contactos
 * @returns Suma total de valores estimados en COP
 * 
 * @example
 * // Si hay 3 leads activos con valores estimados de 100000, 200000, 150000
 * calculatePipelineValue(contacts); // Returns: 450000
 */
export const calculatePipelineValue = (contacts: Contact[]): number => {
    const activeStatuses = [
        LeadStatus.NEW,
        LeadStatus.CONTACTED,
        LeadStatus.INTERESTED
    ];

    return contacts
        .filter(contact => activeStatuses.includes(contact.status))
        .reduce((sum, contact) => sum + (contact.estimatedValue || 0), 0);
};

/**
 * Genera la distribución de contactos por estado para el embudo de ventas
 * Ordenado de mayor a menor cantidad
 * 
 * @param contacts - Lista de contactos
 * @returns Array de pasos del embudo con estado, cantidad y porcentaje
 * 
 * @example
 * const funnel = calculateFunnelByStatus(contacts);
 * // Returns: [
 * //   { status: 'Nuevo', count: 50, percentage: 40 },
 * //   { status: 'Contactado', count: 30, percentage: 24 },
 * //   ...
 * // ]
 */
export const calculateFunnelByStatus = (contacts: Contact[]): FunnelStep[] => {
    const statusLabels: Record<LeadStatus, string> = {
        [LeadStatus.NEW]: 'Lead Nuevo',
        [LeadStatus.CONTACTED]: 'En Seguimiento',
        [LeadStatus.INTERESTED]: 'Interesado',
        [LeadStatus.CLOSED_WON]: 'Venta Cerrada',
        [LeadStatus.CLOSED_LOST]: 'Venta Perdida'
    };

    // Orden del embudo (de arriba hacia abajo)
    const funnelOrder: LeadStatus[] = [
        LeadStatus.NEW,
        LeadStatus.CONTACTED,
        LeadStatus.INTERESTED,
        LeadStatus.CLOSED_WON,
        LeadStatus.CLOSED_LOST
    ];

    const total = contacts.length;

    if (total === 0) {
        return funnelOrder.map(status => ({
            status: statusLabels[status],
            count: 0,
            percentage: 0
        }));
    }

    // Contar contactos por estado
    const counts: Record<string, number> = {};
    contacts.forEach(contact => {
        const statusKey = contact.status;
        counts[statusKey] = (counts[statusKey] || 0) + 1;
    });

    // Construir el embudo en el orden correcto
    return funnelOrder.map(status => {
        const count = counts[status] || 0;
        return {
            status: statusLabels[status],
            count,
            percentage: Math.round((count / total) * 100)
        };
    });
};

/**
 * Formatea un número como moneda COP
 * 
 * @param value - Valor numérico
 * @returns String formateado como moneda colombiana
 */
export const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
};

/**
 * Formatea un número con separadores de miles
 * 
 * @param value - Valor numérico
 * @returns String formateado con separadores de miles
 */
export const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('es-CO').format(value);
};

// ============================================
// FUNCIONES PARA VENTAS & INGRESOS
// ============================================

/**
 * Interfaz para ingresos por producto
 */
export interface ProductRevenue {
    productName: string;
    quantity: number;
    revenue: number;
    percentage: number;
}

/**
 * Interfaz para ingresos por categoría
 */
export interface CategoryRevenue {
    category: string;
    revenue: number;
    percentage: number;
    count: number;
}

/**
 * Interfaz para datos de tendencia
 */
export interface TrendData {
    period: string;
    date: string;
    revenue: number;
    count: number;
}

/**
 * Calcula los ingresos por producto
 * 
 * @param sales - Lista de ventas
 * @returns Array de productos con cantidad, ingresos y porcentaje
 */
export const calculateRevenueByProduct = (sales: Sale[]): ProductRevenue[] => {
    if (sales.length === 0) return [];

    // Agrupar ventas por producto
    const productMap = new Map<string, { quantity: number; revenue: number }>();

    sales.forEach(sale => {
        const existing = productMap.get(sale.productName) || { quantity: 0, revenue: 0 };
        productMap.set(sale.productName, {
            quantity: existing.quantity + 1,
            revenue: existing.revenue + (sale.amount || 0)
        });
    });

    // Calcular total de ingresos
    const totalRevenue = Array.from(productMap.values()).reduce((sum, p) => sum + p.revenue, 0);

    // Convertir a array y ordenar por ingresos
    const result = Array.from(productMap.entries())
        .map(([productName, data]) => ({
            productName,
            quantity: data.quantity,
            revenue: data.revenue,
            percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0
        }))
        .sort((a, b) => b.revenue - a.revenue);

    return result;
};

/**
 * Calcula los ingresos por categoría de producto
 * Las categorías se infieren del nombre del producto
 * 
 * @param sales - Lista de ventas
 * @returns Array de categorías con ingresos y porcentaje
 */
export const calculateRevenueByCategory = (sales: Sale[]): CategoryRevenue[] => {
    if (sales.length === 0) return [];

    // Función para inferir categoría del nombre del producto
    const inferCategory = (productName: string): string => {
        const name = productName.toLowerCase();
        if (name.includes('premier') || name.includes('premium') || name.includes('vip')) {
            return 'Premier';
        }
        if (name.includes('digital') || name.includes('curso') || name.includes('ebook')) {
            return 'Digital';
        }
        if (name.includes('membresía') || name.includes('membresia') || name.includes('suscripción') || name.includes('suscripcion')) {
            return 'Membresía';
        }
        return 'Otros';
    };

    // Agrupar por categoría
    const categoryMap = new Map<string, { revenue: number; count: number }>();

    sales.forEach(sale => {
        const category = inferCategory(sale.productName);
        const existing = categoryMap.get(category) || { revenue: 0, count: 0 };
        categoryMap.set(category, {
            revenue: existing.revenue + (sale.amount || 0),
            count: existing.count + 1
        });
    });

    // Calcular total
    const totalRevenue = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.revenue, 0);

    // Convertir a array
    const result = Array.from(categoryMap.entries())
        .map(([category, data]) => ({
            category,
            revenue: data.revenue,
            percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0,
            count: data.count
        }))
        .sort((a, b) => b.revenue - a.revenue);

    return result;
};

/**
 * Calcula el total de descuentos aplicados
 * 
 * @param sales - Lista de ventas
 * @returns Objeto con total y promedio de descuentos
 */
export const calculateTotalDiscounts = (sales: Sale[]): { total: number; average: number; count: number } => {
    // Filtrar ventas que tienen descuento (usamos el campo discountApplied si existe)
    const salesWithDiscount = sales.filter(sale => (sale as any).discountApplied && (sale as any).discountApplied > 0);

    const total = salesWithDiscount.reduce((sum, sale) => sum + ((sale as any).discountApplied || 0), 0);
    const count = salesWithDiscount.length;
    const average = count > 0 ? Math.round(total / count) : 0;

    return { total, average, count };
};

/**
 * Calcula el ticket promedio
 * 
 * @param sales - Lista de ventas
 * @returns Valor del ticket promedio en COP
 */
export const calculateAverageTicket = (sales: Sale[]): number => {
    if (sales.length === 0) return 0;

    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
    return Math.round(totalRevenue / sales.length);
};

/**
 * Calcula la tendencia de ventas agrupada por semana o mes
 * 
 * @param sales - Lista de ventas
 * @param groupBy - Agrupación: 'week' o 'month'
 * @returns Array de períodos con fecha, ingresos y cantidad
 */
export const calculateSalesTrend = (sales: Sale[], groupBy: 'week' | 'month' = 'week'): TrendData[] => {
    if (sales.length === 0) return [];

    // Función para obtener la clave del período
    const getPeriodKey = (date: Date): string => {
        if (groupBy === 'month') {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else {
            // Calcular semana del año
            const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
            const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
            const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
            return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
        }
    };

    // Función para obtener fecha de inicio del período
    const getPeriodStartDate = (date: Date): Date => {
        if (groupBy === 'month') {
            return new Date(date.getFullYear(), date.getMonth(), 1);
        } else {
            // Obtener el lunes de la semana
            const d = new Date(date);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            return new Date(d.setDate(diff));
        }
    };

    // Agrupar ventas por período
    const periodMap = new Map<string, { revenue: number; count: number; startDate: Date }>();

    sales.forEach(sale => {
        const saleDate = new Date(sale.date);
        const periodKey = getPeriodKey(saleDate);
        const startDate = getPeriodStartDate(saleDate);

        const existing = periodMap.get(periodKey) || { revenue: 0, count: 0, startDate };
        periodMap.set(periodKey, {
            revenue: existing.revenue + (sale.amount || 0),
            count: existing.count + 1,
            startDate: existing.startDate
        });
    });

    // Convertir a array y ordenar por fecha
    const result = Array.from(periodMap.entries())
        .map(([period, data]) => ({
            period,
            date: data.startDate.toISOString().split('T')[0],
            revenue: data.revenue,
            count: data.count
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return result;
};

/**
 * Calcula el total de ingresos en un rango de fechas
 * 
 * @param sales - Lista de ventas
 * @param dateRange - Rango de fechas (opcional)
 * @returns Total de ingresos
 */
export const calculateTotalRevenue = (
    sales: Sale[],
    dateRange?: { start: Date; end: Date }
): number => {
    let filteredSales = sales;

    if (dateRange) {
        filteredSales = sales.filter(sale => {
            const saleDate = new Date(sale.date);
            return saleDate >= dateRange.start && saleDate <= dateRange.end;
        });
    }

    return filteredSales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
};

// ============================================
// FUNCIONES PARA DESEMPEÑO DE VENDEDORAS
// ============================================

/**
 * Calcula el desempeño completo de cada vendedora
 * 
 * @param sales - Lista de ventas
 * @param contacts - Lista de contactos
 * @param interactions - Lista de interacciones
 * @param sellers - Lista de vendedoras
 * @returns Array de desempeño por vendedora ordenado por ventas
 */
export const calculateSalesByVendor = (
    sales: Sale[],
    contacts: Contact[],
    interactions: Interaction[],
    sellers: Seller[]
): VendorPerformance[] => {
    if (sellers.length === 0) return [];

    // Crear mapa de vendedoras
    const vendorMap = new Map<string, VendorPerformance>();

    // Inicializar todas las vendedoras
    sellers.forEach(seller => {
        vendorMap.set(seller.id, {
            vendorId: seller.id,
            vendorName: seller.name,
            salesCount: 0,
            salesAmount: 0,
            conversionRate: 0,
            avgClosingDays: 0,
            activeLeads: 0,
            interactions: 0,
            pendingFollowUps: 0
        });
    });

    // Contar ventas por vendedora
    sales.forEach(sale => {
        const vendor = vendorMap.get(sale.sellerId);
        if (vendor) {
            vendor.salesCount++;
            vendor.salesAmount += sale.amount || 0;
        }
    });

    // Calcular leads activos por vendedora
    const activeStatuses = [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.INTERESTED];
    contacts.forEach(contact => {
        const vendor = vendorMap.get(contact.assignedSellerId);
        if (vendor && activeStatuses.includes(contact.status)) {
            vendor.activeLeads++;
        }
    });

    // Contar interacciones por vendedora
    interactions.forEach(interaction => {
        const vendor = vendorMap.get(interaction.sellerId);
        if (vendor) {
            vendor.interactions++;
        }
    });

    // Calcular tasa de conversión por vendedora
    vendorMap.forEach((vendor, vendorId) => {
        const vendorContacts = contacts.filter(c => c.assignedSellerId === vendorId);
        const won = vendorContacts.filter(c => c.status === LeadStatus.CLOSED_WON).length;
        const lost = vendorContacts.filter(c => c.status === LeadStatus.CLOSED_LOST).length;
        const total = won + lost;
        vendor.conversionRate = total > 0 ? Math.round((won / total) * 100) : 0;
    });

    // Calcular días promedio de cierre
    sales.forEach(sale => {
        const vendor = vendorMap.get(sale.sellerId);
        if (vendor && sale.salesCycleDays) {
            // Acumulamos para calcular promedio después
            (vendor as any)._totalClosingDays = ((vendor as any)._totalClosingDays || 0) + sale.salesCycleDays;
            (vendor as any)._salesWithCycle = ((vendor as any)._salesWithCycle || 0) + 1;
        }
    });

    vendorMap.forEach(vendor => {
        const totalDays = (vendor as any)._totalClosingDays || 0;
        const salesWithCycle = (vendor as any)._salesWithCycle || 0;
        vendor.avgClosingDays = salesWithCycle > 0 ? Math.round(totalDays / salesWithCycle) : 0;
    });

    // Calcular seguimientos pendientes
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    contacts.forEach(contact => {
        if (contact.status === LeadStatus.CLOSED_WON || contact.status === LeadStatus.CLOSED_LOST) return;
        if (!contact.nextContactDate) return;

        const vendor = vendorMap.get(contact.assignedSellerId);
        if (vendor) {
            const nextContact = new Date(contact.nextContactDate);
            if (nextContact >= today && nextContact <= endOfToday) {
                vendor.pendingFollowUps++;
            } else if (nextContact < today) {
                vendor.pendingFollowUps++;
            }
        }
    });

    // Convertir a array y ordenar por monto de ventas
    const result = Array.from(vendorMap.values())
        .sort((a, b) => b.salesAmount - a.salesAmount)
        .map((vendor, index) => ({
            ...vendor,
            rank: index + 1
        }));

    return result;
};

/**
 * Calcula las interacciones por vendedora y tipo
 * 
 * @param interactions - Lista de interacciones
 * @param sellers - Lista de vendedoras
 * @returns Array de interacciones por vendedora
 */
export const calculateInteractionsByVendor = (
    interactions: Interaction[],
    sellers: Seller[]
): VendorInteractions[] => {
    if (sellers.length === 0) return [];

    const vendorMap = new Map<string, VendorInteractions>();

    // Inicializar todas las vendedoras
    sellers.forEach(seller => {
        vendorMap.set(seller.id, {
            vendorId: seller.id,
            vendorName: seller.name,
            total: 0,
            byType: {
                whatsapp: 0,
                email: 0,
                call: 0,
                meeting: 0,
                other: 0
            }
        });
    });

    // Contar interacciones
    interactions.forEach(interaction => {
        const vendor = vendorMap.get(interaction.sellerId);
        if (vendor) {
            vendor.total++;
            // Clasificar por tipo
            const type = interaction.type.toLowerCase();
            if (type.includes('whatsapp')) {
                vendor.byType.whatsapp++;
            } else if (type.includes('email')) {
                vendor.byType.email++;
            } else if (type.includes('llamada') || type.includes('call')) {
                vendor.byType.call++;
            } else if (type.includes('reunión') || type.includes('meeting')) {
                vendor.byType.meeting++;
            } else {
                vendor.byType.other++;
            }
        }
    });

    return Array.from(vendorMap.values()).sort((a, b) => b.total - a.total);
};

/**
 * Calcula la tasa de conversión por vendedora
 * 
 * @param contacts - Lista de contactos
 * @param sellers - Lista de vendedoras
 * @returns Array de conversión por vendedora
 */
export const calculateConversionByVendor = (
    contacts: Contact[],
    sellers: Seller[]
): VendorConversion[] => {
    if (sellers.length === 0) return [];

    const vendorMap = new Map<string, VendorConversion>();

    // Inicializar todas las vendedoras
    sellers.forEach(seller => {
        vendorMap.set(seller.id, {
            vendorId: seller.id,
            vendorName: seller.name,
            totalLeads: 0,
            wonLeads: 0,
            lostLeads: 0,
            conversionRate: 0
        });
    });

    // Contar leads por estado
    contacts.forEach(contact => {
        const vendor = vendorMap.get(contact.assignedSellerId);
        if (vendor) {
            vendor.totalLeads++;
            if (contact.status === LeadStatus.CLOSED_WON) {
                vendor.wonLeads++;
            } else if (contact.status === LeadStatus.CLOSED_LOST) {
                vendor.lostLeads++;
            }
        }
    });

    // Calcular tasa de conversión
    vendorMap.forEach(vendor => {
        const total = vendor.wonLeads + vendor.lostLeads;
        vendor.conversionRate = total > 0 ? Math.round((vendor.wonLeads / total) * 100) : 0;
    });

    return Array.from(vendorMap.values()).sort((a, b) => b.conversionRate - a.conversionRate);
};

/**
 * Calcula el tiempo promedio de cierre por vendedora
 * 
 * @param sales - Lista de ventas
 * @param sellers - Lista de vendedoras
 * @returns Array de tiempo de cierre por vendedora
 */
export const calculateAvgClosingTimeByVendor = (
    sales: Sale[],
    sellers: Seller[]
): VendorClosingTime[] => {
    if (sellers.length === 0) return [];

    const vendorMap = new Map<string, { totalDays: number; count: number; name: string }>();

    // Inicializar todas las vendedoras
    sellers.forEach(seller => {
        vendorMap.set(seller.id, { totalDays: 0, count: 0, name: seller.name });
    });

    // Sumar días de ciclo de venta
    sales.forEach(sale => {
        const vendor = vendorMap.get(sale.sellerId);
        if (vendor && sale.salesCycleDays) {
            vendor.totalDays += sale.salesCycleDays;
            vendor.count++;
        }
    });

    // Convertir a resultado
    return Array.from(vendorMap.entries())
        .map(([id, data]) => ({
            vendorId: id,
            vendorName: data.name,
            avgDays: data.count > 0 ? Math.round(data.totalDays / data.count) : 0,
            salesCount: data.count
        }))
        .sort((a, b) => a.avgDays - b.avgDays);
};

/**
 * Calcula los leads activos por vendedora
 * 
 * @param contacts - Lista de contactos
 * @param sellers - Lista de vendedoras
 * @returns Array de leads por vendedora
 */
export const calculateActiveLeadsByVendor = (
    contacts: Contact[],
    sellers: Seller[]
): VendorLeads[] => {
    if (sellers.length === 0) return [];

    const vendorMap = new Map<string, VendorLeads>();

    // Inicializar todas las vendedoras
    sellers.forEach(seller => {
        vendorMap.set(seller.id, {
            vendorId: seller.id,
            vendorName: seller.name,
            activeLeads: 0,
            newLeads: 0,
            contactedLeads: 0,
            interestedLeads: 0
        });
    });

    // Contar leads por estado
    contacts.forEach(contact => {
        const vendor = vendorMap.get(contact.assignedSellerId);
        if (vendor) {
            switch (contact.status) {
                case LeadStatus.NEW:
                    vendor.newLeads++;
                    vendor.activeLeads++;
                    break;
                case LeadStatus.CONTACTED:
                    vendor.contactedLeads++;
                    vendor.activeLeads++;
                    break;
                case LeadStatus.INTERESTED:
                    vendor.interestedLeads++;
                    vendor.activeLeads++;
                    break;
            }
        }
    });

    return Array.from(vendorMap.values()).sort((a, b) => b.activeLeads - a.activeLeads);
};

/**
 * Calcula los seguimientos pendientes por vendedora
 * 
 * @param contacts - Lista de contactos
 * @param sellers - Lista de vendedoras
 * @returns Array de seguimientos pendientes por vendedora
 */
export const calculatePendingFollowUpsByVendor = (
    contacts: Contact[],
    sellers: Seller[]
): VendorFollowUps[] => {
    if (sellers.length === 0) return [];

    const vendorMap = new Map<string, VendorFollowUps>();

    // Inicializar todas las vendedoras
    sellers.forEach(seller => {
        vendorMap.set(seller.id, {
            vendorId: seller.id,
            vendorName: seller.name,
            today: 0,
            overdue: 0,
            upcoming: 0,
            total: 0
        });
    });

    // Fechas de referencia
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    // Clasificar seguimientos
    contacts.forEach(contact => {
        // Solo contactos activos
        if (contact.status === LeadStatus.CLOSED_WON || contact.status === LeadStatus.CLOSED_LOST) return;
        if (!contact.nextContactDate) return;

        const vendor = vendorMap.get(contact.assignedSellerId);
        if (vendor) {
            const nextContact = new Date(contact.nextContactDate);

            if (nextContact >= today && nextContact <= endOfToday) {
                vendor.today++;
                vendor.total++;
            } else if (nextContact < today) {
                vendor.overdue++;
                vendor.total++;
            } else {
                vendor.upcoming++;
                vendor.total++;
            }
        }
    });

    return Array.from(vendorMap.values()).sort((a, b) => b.total - a.total);
};

// ============================================
// FUNCIONES PARA PIPELINE & ACTIVIDAD
// ============================================

/**
 * Calcula la distribución de leads por estado
 * 
 * @param contacts - Lista de contactos
 * @returns Array de distribución por estado
 */
export const calculateLeadsByStatus = (contacts: Contact[]): StatusDistribution[] => {
    const total = contacts.length;
    if (total === 0) return [];

    // Mapeo de estados a labels
    const statusLabels: Record<string, string> = {
        [LeadStatus.NEW]: 'Lead Nuevo',
        [LeadStatus.CONTACTED]: 'Contactado',
        [LeadStatus.INTERESTED]: 'Calificado',
        'Propuesta Enviada': 'Propuesta Enviada',
        'Negociación': 'Negociación',
        [LeadStatus.CLOSED_WON]: 'Ganado',
        [LeadStatus.CLOSED_LOST]: 'Perdido'
    };

    // Contar por estado
    const counts: Record<string, number> = {};
    contacts.forEach(contact => {
        const status = contact.status;
        counts[status] = (counts[status] || 0) + 1;
    });

    // Convertir a array
    return Object.entries(counts)
        .map(([status, count]) => ({
            status: statusLabels[status] || status,
            count,
            percentage: Math.round((count / total) * 100)
        }))
        .sort((a, b) => b.count - a.count);
};

/**
 * Calcula el análisis de motivos de venta perdida
 * 
 * @param contacts - Lista de contactos
 * @returns Array de análisis de motivos de pérdida
 */
export const calculateLostReasons = (contacts: Contact[]): LostReasonAnalysis[] => {
    // Filtrar contactos perdidos
    const lostContacts = contacts.filter(c => c.status === LeadStatus.CLOSED_LOST);
    const total = lostContacts.length;

    if (total === 0) return [];

    // Contar por motivo
    const counts: Record<string, number> = {};
    lostContacts.forEach(contact => {
        // Usar lostReasonDetail si existe, sino lostReason, sino "Sin especificar"
        const reason = contact.lostReasonDetail ||
            (contact.lostReason ? String(contact.lostReason) : 'Sin especificar');
        counts[reason] = (counts[reason] || 0) + 1;
    });

    // Convertir a array y calcular tendencias simuladas
    // En producción, las tendencias se calcularían comparando con períodos anteriores
    const trendOptions: ('up' | 'down' | 'stable')[] = ['up', 'down', 'stable'];

    return Object.entries(counts)
        .map(([reason, count], index) => ({
            reason,
            count,
            percentage: Math.round((count / total) * 100),
            // Simular tendencia basada en posición (en producción sería real)
            trend: trendOptions[index % 3]
        }))
        .sort((a, b) => b.count - a.count);
};

/**
 * Calcula la distribución de leads por origen/fuente
 * 
 * @param contacts - Lista de contactos
 * @returns Array de distribución por origen
 */
export const calculateLeadsBySource = (contacts: Contact[]): SourceDistribution[] => {
    const total = contacts.length;
    if (total === 0) return [];

    // Contar por origen (leadSource)
    const counts: Record<string, number> = {};
    contacts.forEach(contact => {
        const source = contact.leadSource || 'Sin especificar';
        counts[source] = (counts[source] || 0) + 1;
    });

    return Object.entries(counts)
        .map(([source, count]) => ({
            source,
            count,
            percentage: Math.round((count / total) * 100)
        }))
        .sort((a, b) => b.count - a.count);
};

/**
 * Calcula la distribución de leads por país
 * 
 * @param contacts - Lista de contactos
 * @returns Array de distribución por país
 */
export const calculateLeadsByCountry = (contacts: Contact[]): CountryDistribution[] => {
    const total = contacts.length;
    if (total === 0) return [];

    // Contar por país
    const counts: Record<string, number> = {};
    contacts.forEach(contact => {
        const country = contact.country || 'Sin especificar';
        counts[country] = (counts[country] || 0) + 1;
    });

    return Object.entries(counts)
        .map(([country, count]) => ({
            country,
            count,
            percentage: Math.round((count / total) * 100)
        }))
        .sort((a, b) => b.count - a.count);
};

/**
 * Calcula la distribución de interacciones por canal
 * 
 * @param interactions - Lista de interacciones
 * @returns Array de distribución por canal
 */
export const calculateInteractionsByChannel = (interactions: Interaction[]): ChannelDistribution[] => {
    const total = interactions.length;
    if (total === 0) return [];

    // Contar por tipo/canal
    const counts: Record<string, number> = {};
    interactions.forEach(interaction => {
        const channel = String(interaction.type) || 'Otro';
        counts[channel] = (counts[channel] || 0) + 1;
    });

    return Object.entries(counts)
        .map(([channel, count]) => ({
            channel,
            count,
            percentage: Math.round((count / total) * 100)
        }))
        .sort((a, b) => b.count - a.count);
};

/**
 * Calcula la distribución de resultados de interacciones
 * 
 * @param interactions - Lista de interacciones
 * @returns Array de distribución por resultado
 */
export const calculateInteractionResults = (interactions: Interaction[]): ResultDistribution[] => {
    const total = interactions.length;
    if (total === 0) return [];

    // Contar por resultado
    const counts: Record<string, number> = {};
    interactions.forEach(interaction => {
        const result = interaction.result || 'Sin resultado';
        counts[result] = (counts[result] || 0) + 1;
    });

    return Object.entries(counts)
        .map(([result, count]) => ({
            result,
            count,
            percentage: Math.round((count / total) * 100)
        }))
        .sort((a, b) => b.count - a.count);
};

/**
 * Calcula el promedio de interacciones por lead activo
 * 
 * @param contacts - Lista de contactos
 * @param interactions - Lista de interacciones
 * @returns Promedio de interacciones por lead
 */
export const calculateAvgInteractionsPerLead = (
    contacts: Contact[],
    interactions: Interaction[]
): number => {
    // Contar leads activos (excluyendo Ganados y Perdidos)
    const activeStatuses = [
        LeadStatus.NEW,
        LeadStatus.CONTACTED,
        LeadStatus.INTERESTED
    ];

    const activeLeads = contacts.filter(c => activeStatuses.includes(c.status)).length;

    if (activeLeads === 0) return 0;

    // Total de interacciones
    const totalInteractions = interactions.length;

    return Math.round((totalInteractions / activeLeads) * 10) / 10; // 1 decimal
};

/**
 * Calcula el total de leads perdidos
 * 
 * @param contacts - Lista de contactos
 * @returns Número de leads perdidos
 */
export const calculateLostLeads = (contacts: Contact[]): number => {
    return contacts.filter(c => c.status === LeadStatus.CLOSED_LOST).length;
};

/**
 * Calcula el total de interacciones en un rango de fechas
 * 
 * @param interactions - Lista de interacciones
 * @param dateRange - Rango de fechas (opcional)
 * @returns Total de interacciones
 */
export const calculateTotalInteractions = (
    interactions: Interaction[],
    dateRange?: { start: Date; end: Date }
): number => {
    if (!dateRange) return interactions.length;

    return interactions.filter(interaction => {
        const interactionDate = new Date(interaction.date);
        return interactionDate >= dateRange.start && interactionDate <= dateRange.end;
    }).length;
};

// ============================================
// FUNCIONES PARA CALIDAD & RECUPERACIÓN
// ============================================

/**
 * Calcula la distribución de intentos de compra por estado
 * 
 * @param attempts - Lista de intentos de compra
 * @returns Array de distribución por estado
 */
export const calculatePurchaseAttemptsByStatus = (attempts: PurchaseAttempt[]): AttemptStatusDistribution[] => {
    const total = attempts.length;
    if (total === 0) return [];

    // Contar por estado
    const counts: Record<string, { count: number; totalValue: number }> = {};

    attempts.forEach(attempt => {
        const status = attempt.status;
        if (!counts[status]) {
            counts[status] = { count: 0, totalValue: 0 };
        }
        counts[status].count++;
        counts[status].totalValue += attempt.amount || 0;
    });

    // Convertir a array
    return Object.entries(counts)
        .map(([status, data]) => ({
            status,
            count: data.count,
            percentage: Math.round((data.count / total) * 100),
            totalValue: data.totalValue
        }))
        .sort((a, b) => b.count - a.count);
};

/**
 * Calcula las métricas de recuperación de intentos fallidos/abandonados
 * 
 * @param attempts - Lista de intentos de compra
 * @param contacts - Lista de contactos (para verificar recuperaciones)
 * @returns Objeto con métricas de recuperación
 */
export const calculateRecoveryMetrics = (attempts: PurchaseAttempt[], contacts: Contact[]): RecoveryMetrics => {
    // Intentos recuperables: Fallidos + Abandonados
    const recoverableAttempts = attempts.filter(a =>
        a.status === PurchaseAttemptStatus.FAILED ||
        a.status === PurchaseAttemptStatus.ABANDONED
    );

    const totalRecoverable = recoverableAttempts.length;
    const potentialValue = recoverableAttempts.reduce((sum, a) => sum + (a.amount || 0), 0);

    // Intentos recuperados: aquellos con recoverySellerId asignado
    const recoveredAttempts = recoverableAttempts.filter(a => a.recoverySellerId);
    const recovered = recoveredAttempts.length;
    const recoveredValue = recoveredAttempts.reduce((sum, a) => sum + (a.amount || 0), 0);

    // Tasa de recuperación
    const recoveryRate = totalRecoverable > 0
        ? Math.round((recovered / totalRecoverable) * 100)
        : 0;

    return {
        totalRecoverable,
        recovered,
        recoveryRate,
        potentialValue,
        recoveredValue
    };
};

/**
 * Calcula la recuperación por vendedora
 * 
 * @param attempts - Lista de intentos de compra
 * @param sellers - Lista de vendedoras
 * @returns Array de recuperación por vendedora
 */
export const calculateRecoveryByVendor = (attempts: PurchaseAttempt[], sellers: Seller[]): VendorRecovery[] => {
    if (sellers.length === 0) return [];

    // Filtrar intentos recuperables
    const recoverableAttempts = attempts.filter(a =>
        a.status === PurchaseAttemptStatus.FAILED ||
        a.status === PurchaseAttemptStatus.ABANDONED
    );

    // Crear mapa de vendedoras
    const vendorMap = new Map<string, VendorRecovery>();

    // Inicializar todas las vendedoras
    sellers.forEach(seller => {
        vendorMap.set(seller.id, {
            vendorId: seller.id,
            vendorName: seller.name,
            assignedAttempts: 0,
            recoveredAttempts: 0,
            recoveryRate: 0,
            recoveredValue: 0
        });
    });

    // Contar intentos asignados y recuperados por vendedora
    recoverableAttempts.forEach(attempt => {
        if (attempt.recoverySellerId) {
            const vendor = vendorMap.get(attempt.recoverySellerId);
            if (vendor) {
                vendor.assignedAttempts++;
                // Si el intento fue recuperado (asumimos que si tiene vendedora asignada está en proceso o recuperado)
                vendor.recoveredAttempts++;
                vendor.recoveredValue += attempt.amount || 0;
            }
        }
    });

    // Calcular tasa de recuperación por vendedora
    vendorMap.forEach(vendor => {
        if (vendor.assignedAttempts > 0) {
            vendor.recoveryRate = Math.round((vendor.recoveredAttempts / vendor.assignedAttempts) * 100);
        }
    });

    // Filtrar vendedoras con intentos asignados y ordenar por tasa de recuperación
    return Array.from(vendorMap.values())
        .filter(v => v.assignedAttempts > 0)
        .sort((a, b) => b.recoveryRate - a.recoveryRate);
};

/**
 * Calcula la tendencia de intentos de compra agrupada por semana o mes
 * 
 * @param attempts - Lista de intentos de compra
 * @param groupBy - Agrupación: 'week' o 'month'
 * @returns Array de datos de tendencia
 */
export const calculateAttemptTrends = (attempts: PurchaseAttempt[], groupBy: 'week' | 'month' = 'week'): AttemptTrendData[] => {
    if (attempts.length === 0) return [];

    // Función para obtener la clave del período
    const getPeriodKey = (date: Date): string => {
        if (groupBy === 'month') {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else {
            // Calcular semana del año
            const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
            const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
            const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
            return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
        }
    };

    // Función para obtener fecha de inicio del período
    const getPeriodStartDate = (date: Date): Date => {
        if (groupBy === 'month') {
            return new Date(date.getFullYear(), date.getMonth(), 1);
        } else {
            // Obtener el lunes de la semana
            const d = new Date(date);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            return new Date(d.setDate(diff));
        }
    };

    // Agrupar intentos por período y estado
    const periodMap = new Map<string, {
        startDate: Date;
        successful: number;
        failed: number;
        abandoned: number
    }>();

    attempts.forEach(attempt => {
        const attemptDate = new Date(attempt.date);
        const periodKey = getPeriodKey(attemptDate);
        const startDate = getPeriodStartDate(attemptDate);

        const existing = periodMap.get(periodKey) || {
            startDate,
            successful: 0,
            failed: 0,
            abandoned: 0
        };

        switch (attempt.status) {
            case PurchaseAttemptStatus.SUCCESSFUL:
                existing.successful++;
                break;
            case PurchaseAttemptStatus.FAILED:
                existing.failed++;
                break;
            case PurchaseAttemptStatus.ABANDONED:
                existing.abandoned++;
                break;
        }

        periodMap.set(periodKey, existing);
    });

    // Convertir a array y ordenar por fecha
    return Array.from(periodMap.entries())
        .map(([period, data]) => ({
            period,
            date: data.startDate.toISOString().split('T')[0],
            successful: data.successful,
            failed: data.failed,
            abandoned: data.abandoned
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Calcula el total de intentos fallidos
 * 
 * @param attempts - Lista de intentos de compra
 * @returns Número de intentos fallidos o abandonados
 */
export const calculateFailedAttempts = (attempts: PurchaseAttempt[]): number => {
    return attempts.filter(a =>
        a.status === PurchaseAttemptStatus.FAILED ||
        a.status === PurchaseAttemptStatus.ABANDONED
    ).length;
};

/**
 * Calcula el valor total recuperado
 * 
 * @param attempts - Lista de intentos de compra
 * @returns Valor total de intentos recuperados
 */
export const calculateRecoveredValue = (attempts: PurchaseAttempt[]): number => {
    const recoverableAttempts = attempts.filter(a =>
        a.status === PurchaseAttemptStatus.FAILED ||
        a.status === PurchaseAttemptStatus.ABANDONED
    );

    return recoverableAttempts
        .filter(a => a.recoverySellerId)
        .reduce((sum, a) => sum + (a.amount || 0), 0);
};
