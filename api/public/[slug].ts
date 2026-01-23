// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const slug = req.query?.slug || (req.url || '').split('/').pop();
  if (!slug || typeof slug !== 'string') return res.status(400).json({ error: 'INVALID_SLUG' });

  try {
    const { data, error } = await supabaseAdmin
      .from('saved_results')
      .select('id, tool_name, input_data, results, created_at, is_public, public_slug')
      .eq('public_slug', slug)
      .eq('is_public', true)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ result: data });
  } catch (err: any) {
    console.error('[Public][GET] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
}
