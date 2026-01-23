// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = (req.headers['x-user-id'] || req.headers['X-User-Id']) as string | undefined;
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  try {
    const { data, error } = await supabaseAdmin
      .from('saved_results')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ results: data });
  } catch (err: any) {
    console.error('[Results][GET] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
}
