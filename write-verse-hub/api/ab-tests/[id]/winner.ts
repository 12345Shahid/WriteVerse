import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseAdminClient: SupabaseClient | null = null;

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    console.warn('[API][ab-tests/:id/winner] Missing SUPABASE_URL or SERVICE_ROLE key');
    return null;
  }
  if (!supabaseAdminClient) {
    console.log('[API][ab-tests/:id/winner] Creating Supabase admin client');
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
      console.debug('[API][ab-tests/:id/winner] No X-User-Id header present');
    }
    return id;
  } catch (e: any) {
    console.error('[API][ab-tests/:id/winner] getUserIdFromHeader error', e);
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
  const { id } = req.query as { id?: string };
  const { winner } = req.body || {};

  if (winner !== 'A' && winner !== 'B') {
    return res.status(400).json({ message: 'Invalid winner' });
  }

  try {
    if (supabaseAdmin && userId && id) {
      const { data, error } = await supabaseAdmin
        .from('ab_tests')
        .update({ winner })
        .eq('id', id)
        .eq('user_id', userId)
        .select('*')
        .single();
      if (error) throw error;
      console.debug('[API][ab-tests/:id/winner] Winner set', { id, winner });
      return res.status(200).json({ test: data });
    }
    return res.status(200).json({ test: { id, winner } });
  } catch (e: any) {
    console.error('[API][ab-tests/:id/winner] Error', e);
    return res.status(500).json({ message: e?.message || 'Internal error' });
  }
}
