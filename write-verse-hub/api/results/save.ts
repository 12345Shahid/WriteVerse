import { z } from 'zod';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseAdminClient: SupabaseClient | null = null;

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    console.warn('[API][results/save] Missing SUPABASE_URL or SERVICE_ROLE key');
    return null;
  }
  if (!supabaseAdminClient) {
    console.log('[API][results/save] Creating Supabase admin client');
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
      console.debug('[API][results/save] No X-User-Id header present');
    }
    return id;
  } catch (e: any) {
    console.error('[API][results/save] getUserIdFromHeader error', e);
    return null;
  }
}

const SaveResultsSchema = z.object({
  tool_name: z.string(),
  input_data: z.any(),
  results: z.any(),
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const userId = getUserIdFromHeader(req);

  if (!supabaseAdmin) {
    console.error('[API][results/save] Supabase admin not configured');
    return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  }
  if (!userId) {
    console.warn('[API][results/save] Missing X-User-Id header');
    return res.status(401).json({ error: 'NO_USER_ID' });
  }

  const parsed = SaveResultsSchema.safeParse(req.body || {});
  if (!parsed.success) {
    console.error('[API][results/save] Validation failed', parsed.error.flatten());
    return res.status(400).json({ error: 'INVALID_REQUEST', details: parsed.error.flatten() });
  }

  try {
    const payload = { ...parsed.data, user_id: userId };
    const { data, error } = await supabaseAdmin
      .from('saved_results')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    console.debug('[API][results/save] Saved result', { id: data?.id });
    return res.status(200).json({ saved: data });
  } catch (err: any) {
    console.error('[API][results/save] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
}
