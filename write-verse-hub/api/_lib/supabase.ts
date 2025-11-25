import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    console.warn('[API][_lib/supabase] Missing SUPABASE_URL or SERVICE_ROLE key');
    return null;
  }
  if (!client) {
    console.log('[API][_lib/supabase] Creating Supabase admin client');
    client = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

export function getUserIdFromHeader(req: any): string | null {
  try {
    const v = (req.headers?.['x-user-id'] || req.headers?.['X-User-Id'] || req.headers?.['X-USER-ID']) as
      | string
      | undefined;
    const id = (v && String(v)) || null;
    if (!id) {
      console.debug('[API][_lib/supabase] No X-User-Id header present');
    }
    return id;
  } catch (e: any) {
    console.error('[API][_lib/supabase] getUserIdFromHeader error', e);
    return null;
  }
}

export function requiredEnv(names: string[]) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    console.warn('[API][_lib/supabase] Missing env vars', { missing });
  }
  return { ok: missing.length === 0, missing };
}
