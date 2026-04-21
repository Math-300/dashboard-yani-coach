/**
 * Espejo en TS de la función SQL public.map_estado_simplificado (migración 06).
 * Mantener ambas sincronizadas si se agregan estados nuevos en NocoDB.
 */
export function mapEstadoSimplificado(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  if (raw === 'Nuevo' || raw === 'Lead Nuevo') return 'Nuevo';
  if (raw === 'Venta Cerrada' || raw === 'Venta Ganada') return 'Venta Cerrada';
  if (raw === 'Interesado') return 'Interesado';
  if (raw === 'Llamada Agendada' || raw === 'Seguimiento Potencial venta') return 'Interesado';
  if (
    raw === 'Venta Perdida' ||
    raw === 'no contactar' ||
    raw === 'No se presentó' ||
    raw === 'Seguimiento venta perdida' ||
    raw.startsWith('Leads perdidos')
  ) return 'Venta Perdida';
  if (
    raw === 'Contactado' ||
    raw === 'Mensaje Inicial Enviado' ||
    raw === 'Contactar en 48 horas' ||
    raw === 'Nutrición a Largo Plazo' ||
    raw === 'Seguimiento Cliente Nuevo' ||
    raw.startsWith('En Seguimiento') ||
    raw.startsWith('Seguimiento leads')
  ) return 'Contactado';
  return 'Otro';
}

/**
 * Mapping de estado de intentos de compra al 4-bucket (espejo SQL migración 07).
 */
export function mapIntentoStatus(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  const s = raw.toLowerCase();
  if (s.includes('recuperado')) return 'Exitoso';
  if (s.includes('fallido')) return 'Fallido';
  if (s.includes('cancelad') || s.includes('abandonad')) return 'Abandonado';
  if (s.includes('exitoso')) return 'Exitoso';
  return 'Otro';
}

/** Convierte número/string a number | null. */
export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Devuelve string no-vacío o null. */
export function toText(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

/** Devuelve ISO date (con timezone) o null. NocoDB devuelve "YYYY-MM-DD HH:MM:SS+00:00". */
export function toIsoDate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Toma el máximo (más reciente) de un array de fechas ISO de NocoDB. */
export function maxIsoDate(arr: unknown): string | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const times = arr
    .map(toIsoDate)
    .filter((x): x is string => x !== null)
    .map((iso) => Date.parse(iso));
  if (times.length === 0) return null;
  return new Date(Math.max(...times)).toISOString();
}

/** Divide un array en batches de tamaño N. */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Remueve campos ruidosos del payload crudo antes de guardarlo en la columna `raw`.
 * Evita "cambios" falsos en cada sync por signed URLs que rotan cada request.
 */
export function cleanRaw(row: Record<string, unknown>, extraKeys: string[] = []): Record<string, unknown> {
  const NOISY = new Set([
    'Usuario Asignado',
    'Usuario del Sistema',
    'Avatar',
    'Foto',
    'Adjuntos',
    ...extraKeys,
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (NOISY.has(k)) continue;
    if (k.startsWith('_nc_m2m_')) continue;
    out[k] = v;
  }
  return out;
}
