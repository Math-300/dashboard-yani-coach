/**
 * Presets de rango de fechas compartidos entre App.tsx y DateRangePicker.
 * Usar `getPresetRange(preset)` para obtener `{ start, end }` recalculado a partir de la fecha actual.
 */

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'last_30_days'
  | 'month'
  | 'last_month'
  | 'last_6_months'
  | 'custom';

export const DEFAULT_PRESET: DateRangePreset = 'last_30_days';

const LS_PRESET_KEY = 'yani.dateRange.preset';
const LS_CUSTOM_KEY = 'yani.dateRange.custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export function getPresetRange(preset: DateRangePreset): DateRange {
  const now = new Date();
  const start = new Date();
  const end = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  switch (preset) {
    case 'today':
      return { start, end };
    case 'yesterday': {
      const y = new Date(start);
      y.setDate(now.getDate() - 1);
      const yEnd = new Date(y);
      yEnd.setHours(23, 59, 59, 999);
      return { start: y, end: yEnd };
    }
    case 'week':
      start.setDate(now.getDate() - 7);
      return { start, end };
    case 'last_30_days':
      start.setDate(now.getDate() - 30);
      return { start, end };
    case 'month': {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      firstOfMonth.setHours(0, 0, 0, 0);
      return { start: firstOfMonth, end };
    }
    case 'last_month': {
      const firstOfPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      firstOfPrev.setHours(0, 0, 0, 0);
      const lastOfPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      lastOfPrev.setHours(23, 59, 59, 999);
      return { start: firstOfPrev, end: lastOfPrev };
    }
    case 'last_6_months': {
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      sixMonthsAgo.setHours(0, 0, 0, 0);
      return { start: sixMonthsAgo, end };
    }
    case 'custom':
      return { start, end };
  }
}

export function savePresetSelection(preset: DateRangePreset, range?: DateRange): void {
  try {
    localStorage.setItem(LS_PRESET_KEY, preset);
    if (preset === 'custom' && range) {
      localStorage.setItem(
        LS_CUSTOM_KEY,
        JSON.stringify({ start: range.start.toISOString(), end: range.end.toISOString() })
      );
    } else {
      localStorage.removeItem(LS_CUSTOM_KEY);
    }
  } catch {
    // localStorage no disponible (SSR / privacy mode) — no bloquear
  }
}

export function loadInitialRange(): { preset: DateRangePreset; range: DateRange } {
  try {
    const stored = localStorage.getItem(LS_PRESET_KEY) as DateRangePreset | null;
    if (stored === 'custom') {
      const raw = localStorage.getItem(LS_CUSTOM_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { start: string; end: string };
        const start = new Date(parsed.start);
        const end = new Date(parsed.end);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          return { preset: 'custom', range: { start, end } };
        }
      }
    } else if (stored && isValidPreset(stored)) {
      return { preset: stored, range: getPresetRange(stored) };
    }
  } catch {
    // fallthrough al default
  }
  return { preset: DEFAULT_PRESET, range: getPresetRange(DEFAULT_PRESET) };
}

function isValidPreset(v: string): v is DateRangePreset {
  return ['today', 'yesterday', 'week', 'last_30_days', 'month', 'last_month', 'last_6_months', 'custom'].includes(v);
}

export const isDateInRange = (dateString: string, start: Date, end: Date): boolean => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return false;
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
};
