/**
 * Cliente Supabase — singleton para lecturas del Dashboard.
 * Usa la anon key (pública por diseño, protegida por RLS).
 * Multi-tenant: todo query filtra por `tenant_id = TENANT_ID` explícito.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// @ts-ignore - Vite env
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
// @ts-ignore
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;
// @ts-ignore
const TENANT_ID_ENV = import.meta.env?.VITE_SUPABASE_TENANT_ID as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TENANT_ID_ENV) {
  // Error visible — sin fallback — regla: "no mocks, no fallbacks".
  // Eso incluye: no usar NocoDB como plan B. Si Supabase no está configurado,
  // el Dashboard se cae al intentar renderizar. Es lo que queremos.
  console.error(
    '[Supabase] Falta config. Necesito VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_TENANT_ID en .env.local',
  );
}

export const TENANT_ID: string = TENANT_ID_ENV || '';

export const supabase: SupabaseClient = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '', {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: 'public' },
});
