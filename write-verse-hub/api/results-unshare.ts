import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseAdminClient: SupabaseClient | null = null;

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    console.warn('[API][results-unshare] Missing SUPABASE_URL or SERVICE_ROLE key');
    return null;
  }
  if (!supabaseAdminClient) {
    console.log('[API][results-unshare] Creating Supabase admin client');
    supabaseAdminClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseAdminClient;
}

function getUserIdFromHeader(req: any): string | null {
  try {
    const v = (req.headers?.['x-user-id'] || req.headers?.['X-User-Id'] || req.headers?.['X-USER-ID']) as
      | string
      | undefined;
    const id = (v && String(v)) || null;
    if (!id) {
      console.debug('[API][results-unshare] No X-User-Id header present');
    }
    return id;
  } catch (e: any) {
    console.error('[API][results-unshare] getUserIdFromHeader error', e);
    return null;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const userId = getUserIdFromHeader(req);
  const { id } = (req.body || {}) as { id?: string };

  if (!id) {
    return res.status(400).json({ message: 'Missing id' });
  }

  try {
    if (supabaseAdmin && userId) {
      const { error } = await supabaseAdmin
        .from('saved_results')
        .update({ is_public: false, public_slug: null })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
    }
    console.debug('[API][results-unshare] Unshared result', { id, userId });
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('[API][results-unshare] Error', e);
    return res.status(500).json({ message: e?.message || 'Internal error' });
  }
}
