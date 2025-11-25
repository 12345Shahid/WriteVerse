import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseAdminClient: SupabaseClient | null = null;

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    console.warn('[API][results/:id] Missing SUPABASE_URL or SERVICE_ROLE key');
    return null;
  }
  if (!supabaseAdminClient) {
    console.log('[API][results/:id] Creating Supabase admin client');
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
      console.debug('[API][results/:id] No X-User-Id header present');
    }
    return id;
  } catch (e: any) {
    console.error('[API][results/:id] getUserIdFromHeader error', e);
    return null;
  }
}

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  const userId = getUserIdFromHeader(req);
  const { id } = req.query as { id?: string };

  if (req.method === 'DELETE') {
    try {
      if (supabaseAdmin && userId && id) {
        const { error } = await supabaseAdmin
          .from('saved_results')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);
        if (error) throw error;
      }
      console.debug('[API][results/:id] Deleted result', { id, userId });
      return res.status(200).json({ ok: true });
    } catch (e: any) {
      console.error('[API][results/:id] Error', e);
      return res.status(500).json({ message: e?.message || 'Internal error' });
    }
  }

  res.setHeader('Allow', 'DELETE');
  return res.status(405).json({ message: 'Method not allowed' });
}
