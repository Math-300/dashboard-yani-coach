/**
 * Sync incremental por marca temporal.
 *
 * En vez de full-scan de ~32k contactos + interacciones + 2230 convs Chatwoot cada
 * hora (que satura NocoDB Cloud con 429), este módulo calcula una ventana temporal
 * a partir del último sync exitoso registrado en `sync_runs` y sólo trae lo cambiado.
 *
 * Cortes que fuerzan un full/reconcile (devuelven null):
 *   - FORCE_FULL_SYNC=1 en el env (reconcile diario o corrida manual forzada)
 *   - no hay sync previo exitoso (primer arranque / tabla nueva)
 *   - el gap desde el último sync exitoso supera 7 días (reconcile de seguridad)
 *
 * Campos de sistema de NocoDB: `UpdatedAt` y `CreatedAt` (ambos poblados).
 * En Chatwoot el corte usa `last_activity_at` (epoch en segundos).
 *
 * Reusa la tabla Supabase `sync_runs` existente (sin migración).
 */
import { supabaseAdmin } from './supabaseAdmin.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RECONCILE_GAP_DAYS = 7;
const CHATWOOT_LOOKBACK_MS = 2 * 60 * 60 * 1000; // 2h de solape defensivo

const forceFullSync = (): boolean => process.env.FORCE_FULL_SYNC === '1';

/**
 * Devuelve el `started_at` (ms epoch) del último sync exitoso de esa tabla,
 * o null si no hay ninguno.
 */
async function lastSuccessStartedAtMs(
  tenantId: string,
  tableName: string,
): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from('sync_runs')
    .select('started_at')
    .eq('tenant_id', tenantId)
    .eq('table_name', tableName)
    .eq('status', 'success')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.started_at) return null;
  const ms = new Date(data.started_at as string).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Ventana incremental en días para el filtro NocoDB, o null si toca full/reconcile.
 * Cuando hay ventana, se toma `max(2, ceil(gapDays)+1)` para cubrir con holgura el
 * intervalo desde el último sync (más buffer por relojes/latencias).
 */
export async function getIncrementalWindowDays(
  tenantId: string,
  tableName: string,
): Promise<number | null> {
  if (forceFullSync()) return null;
  const lastMs = await lastSuccessStartedAtMs(tenantId, tableName);
  if (lastMs === null) return null;
  const gapDays = (Date.now() - lastMs) / MS_PER_DAY;
  if (gapDays > RECONCILE_GAP_DAYS) return null;
  return Math.max(2, Math.ceil(gapDays) + 1);
}

/**
 * Cláusula `where` de NocoDB v2 que trae filas modificadas O creadas dentro de los
 * últimos `days` días. Cubre tanto updates como inserts recientes.
 */
export function updatedWithinWhere(days: number): string {
  return `(UpdatedAt,isWithin,pastNumberOfDays,${days})~or(CreatedAt,isWithin,pastNumberOfDays,${days})`;
}

/**
 * Cursor epoch (segundos) para filtrar conversaciones Chatwoot por `last_activity_at`,
 * o null si toca full/reconcile. Se resta 2h al último sync exitoso como solape
 * defensivo (relojes, actividad en vuelo).
 */
export async function getChatwootCursorEpoch(tenantId: string): Promise<number | null> {
  if (forceFullSync()) return null;
  const lastMs = await lastSuccessStartedAtMs(tenantId, 'chatwoot');
  if (lastMs === null) return null;
  const gapDays = (Date.now() - lastMs) / MS_PER_DAY;
  if (gapDays > RECONCILE_GAP_DAYS) return null;
  return Math.floor((lastMs - CHATWOOT_LOOKBACK_MS) / 1000);
}
