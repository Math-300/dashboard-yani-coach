import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  },
);

let cachedTenantId: string | null = null;

export async function getTenantId(): Promise<string> {
  if (cachedTenantId) return cachedTenantId;
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('slug', env.TENANT_SLUG)
    .single();
  if (error || !data) {
    throw new Error(`Tenant '${env.TENANT_SLUG}' no encontrado: ${error?.message}`);
  }
  cachedTenantId = data.id;
  return data.id;
}
