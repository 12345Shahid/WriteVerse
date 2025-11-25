import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    return null;
  }
  if (!client) {
    client = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

export function getUserIdFromHeader(req: any): string | null {
  const v = (req.headers?.['x-user-id'] || req.headers?.['X-User-Id'] || req.headers?.['X-USER-ID']) as string | undefined;
  return (v && String(v)) || null;
}

export function requiredEnv(names: string[]) {
  const missing = names.filter((n) => !process.env[n]);
  return { ok: missing.length === 0, missing };
}
