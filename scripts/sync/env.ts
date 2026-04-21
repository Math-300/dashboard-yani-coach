import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Prioridad: .env.local → .env (Vite convention). Cargar en orden; el primero gana.
for (const file of ['.env.local', '.env']) {
  const p = resolve(process.cwd(), file);
  if (existsSync(p)) loadDotenv({ path: p, override: false });
}

function must(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Falta env var obligatoria: ${name}. Revisá .env.local.`);
  }
  return v.trim();
}

export const env = {
  NOCODB_URL: process.env.VITE_NOCODB_URL?.trim() || 'https://app.nocodb.com',
  NOCODB_TOKEN: must('VITE_NOCODB_TOKEN'),

  TABLE_SELLERS: process.env.VITE_TABLE_SELLERS?.trim() || 'me6kwgo0qvg0aug',
  TABLE_CONTACTS: process.env.VITE_TABLE_CONTACTS?.trim() || 'mrwhtwissgz1xzr',
  TABLE_INTERACTIONS: process.env.VITE_TABLE_INTERACTIONS?.trim() || 'm6gx25reozjbbt3',
  TABLE_SALES: process.env.VITE_TABLE_SALES?.trim() || 'mm9p02mlk0i5ysy',
  TABLE_ATTEMPTS: process.env.VITE_TABLE_ATTEMPTS?.trim() || 'mqdlglkwjvvtplc',

  SUPABASE_URL: must('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: must('SUPABASE_SERVICE_ROLE_KEY'),
  TENANT_SLUG: process.env.SUPABASE_TENANT_SLUG?.trim() || 'yani-coach',
};
