import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseAdminClient: SupabaseClient | null = null;

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    console.warn('[API][ab-tests] Missing SUPABASE_URL or SERVICE_ROLE key');
    return null;
  }
  if (!supabaseAdminClient) {
    console.log('[API][ab-tests] Creating Supabase admin client');
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
      console.debug('[API][ab-tests] No X-User-Id header present');
    }
    return id;
  } catch (e: any) {
    console.error('[API][ab-tests] getUserIdFromHeader error', e);
    return null;
  }
}

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  const userId = getUserIdFromHeader(req);

  if (req.method === 'GET') {
    if (!supabaseAdmin) {
      console.error('[API][ab-tests][GET] Supabase admin not configured');
      return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
    }
    if (!userId) {
      console.warn('[API][ab-tests][GET] Missing X-User-Id header');
      return res.status(401).json({ error: 'NO_USER_ID' });
    }
    try {
      const { data, error } = await supabaseAdmin
        .from('ab_tests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      console.debug('[API][ab-tests][GET] Tests fetched', { count: (data || []).length });
      return res.status(200).json({ tests: data });
    } catch (err: any) {
      console.error('[API][ab-tests][GET] Error', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
    }
  }

  if (req.method === 'POST') {
    if (!supabaseAdmin) {
      console.error('[API][ab-tests][POST] Supabase admin not configured');
      return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
    }
    if (!userId) {
      console.warn('[API][ab-tests][POST] Missing X-User-Id header');
      return res.status(401).json({ error: 'NO_USER_ID' });
    }

    const body = req.body || {};
    const { tool_name, variant_a, variant_b, input_summary } = body;
    if (!tool_name || !variant_a || !variant_b) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'tool_name, variant_a, variant_b required',
      });
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('ab_tests')
        .insert({
          user_id: userId,
          tool_name,
          input_summary: input_summary || null,
          variant_a,
          variant_b,
        })
        .select('*')
        .single();
      if (error) throw error;
      console.debug('[API][ab-tests][POST] Test created', { id: data?.id });
      return res.status(200).json({ test: data });
    } catch (err: any) {
      console.error('[API][ab-tests][POST] Error', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ message: 'Method not allowed' });
}
