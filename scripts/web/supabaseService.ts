/**
 * Cliente Supabase con service_role para el server web de producción.
 *
 * Cambio de postura de seguridad deliberado: hasta ahora el contenedor web
 * NO tenía service_role (solo el bundle horneado con la anon key). A partir
 * de esta tarea sí la tiene, para poder servir filas de personas — pero
 * SOLO detrás del guard `requireSession` (cookie `yd_auth` válida). Nunca se
 * expone directo al navegador: vive únicamente en este proceso server-side.
 *
 * Falla fuerte (regla del proyecto): un deploy de producción sin
 * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY debe crashear al boot, no
 * responder 500 silenciosos endpoint por endpoint.
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL ?? '';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const IS_PROD = process.env.NODE_ENV === 'production';

if ((!URL || !KEY) && IS_PROD) {
  console.error('[web] FALTA SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — endpoints /api/metrics caerán');
  process.exit(1);
}

export const TENANT_ID = process.env.SUPABASE_TENANT_ID ?? '';

export const supabaseService = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: 'public' },
});
