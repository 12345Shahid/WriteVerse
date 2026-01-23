// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export default async function handler(req: any, res: any) {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const userId = (req.headers['x-user-id'] || req.headers['X-User-Id']) as string | undefined;
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabaseAdmin
        .from('ab_tests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.json({ tests: data });
    } catch (err: any) {
      console.error('[ABTests][LIST] Error', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
    }
  }

  if (req.method === 'POST') {
    const { tool_name, variant_a, variant_b, input_summary } = req.body || {};
    if (!tool_name || !variant_a || !variant_b) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'tool_name, variant_a, variant_b required' });
    }
    try {
      const { data, error } = await supabaseAdmin
        .from('ab_tests')
        .insert({ user_id: userId, tool_name, input_summary: input_summary || null, variant_a, variant_b })
        .select('*')
        .single();
      if (error) throw error;
      return res.json({ test: data });
    } catch (err: any) {
      console.error('[ABTests][CREATE] Error', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
    }
  }

  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
}
