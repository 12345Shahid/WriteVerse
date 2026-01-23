import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    console.warn('[API][supabaseAdmin] Missing SUPABASE_URL or SERVICE_ROLE key');
    return null;
  }
  if (!client) {
    console.log('[API][supabaseAdmin] Creating Supabase admin client');
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
      console.debug('[API][supabaseAdmin] No X-User-Id header present');
    }
    return id;
  } catch (e: any) {
    console.error('[API][supabaseAdmin] getUserIdFromHeader error', e);
    return null;
  }
}
