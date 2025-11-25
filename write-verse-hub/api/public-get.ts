import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseAdminClient: SupabaseClient | null = null;

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    console.warn('[API][public-get] Missing SUPABASE_URL or SERVICE_ROLE key');
    return null;
  }
  if (!supabaseAdminClient) {
    console.log('[API][public-get] Creating Supabase admin client');
    supabaseAdminClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseAdminClient;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { slug } = req.query as { slug?: string };

  if (!slug) {
    return res.status(400).json({ message: 'Missing slug' });
  }

  if (!supabaseAdmin) {
    console.error('[API][public-get] Supabase admin not configured');
    return res.status(404).json({ message: 'Not found' });
  }

  try {
    const { data } = await supabaseAdmin
      .from('saved_results')
      .select('id,tool_name,input_data,results,created_at,public_slug')
      .eq('public_slug', slug)
      .eq('is_public', true)
      .single();
    if (!data) {
      return res.status(404).json({ message: 'Not found' });
    }
    return res.status(200).json({ result: data });
  } catch (e: any) {
    console.error('[API][public-get] Error', e);
    return res.status(500).json({ message: e?.message || 'Internal error' });
  }
}
