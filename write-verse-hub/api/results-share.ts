import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseAdminClient: SupabaseClient | null = null;

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    console.warn('[API][results-share] Missing SUPABASE_URL or SERVICE_ROLE key');
    return null;
  }
  if (!supabaseAdminClient) {
    console.log('[API][results-share] Creating Supabase admin client');
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
      console.debug('[API][results-share] No X-User-Id header present');
    }
    return id;
  } catch (e: any) {
    console.error('[API][results-share] getUserIdFromHeader error', e);
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
    const slug = `r-${id}`;
    if (supabaseAdmin && userId) {
      const { data, error } = await supabaseAdmin
        .from('saved_results')
        .update({ is_public: true, public_slug: slug })
        .eq('id', id)
        .eq('user_id', userId)
        .select('public_slug')
        .single();
      if (error) throw error;
      const publicSlug = data?.public_slug || slug;
      console.debug('[API][results-share] Shared result', { id, publicSlug });
      return res.status(200).json({ public_slug: publicSlug });
    }
    return res.status(200).json({ public_slug: slug });
  } catch (e: any) {
    console.error('[API][results-share] Error', e);
    return res.status(500).json({ message: e?.message || 'Internal error' });
  }
}
