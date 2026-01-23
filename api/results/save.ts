// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = (req.headers['x-user-id'] || req.headers['X-User-Id']) as string | undefined;
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });

  const { tool_name, input_data, results } = req.body || {};
  if (!tool_name || input_data === undefined || results === undefined) {
    return res.status(400).json({ error: 'INVALID_REQUEST', message: 'tool_name, input_data, results required' });
  }

  try {
    const payload = { tool_name, input_data, results, user_id: userId };
    const { data, error } = await supabaseAdmin
      .from('saved_results')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return res.json({ saved: data });
  } catch (err: any) {
    console.error('[Results][SAVE] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
}
