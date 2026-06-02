/**
 * Formatea minutos a un string humano:
 *   8   → "8 min"
 *   59  → "59 min"
 *   60  → "1h"
 *   119 → "1h 59m"
 *   125 → "2h 5m"
 * Redondea al minuto. Negativos o NaN → "0 min".
 */
export function formatDuration(min: number): string {
  if (!Number.isFinite(min) || min < 0) return '0 min';
  if (min > 0 && min < 1) return '< 1 min';
  const total = Math.round(min);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
