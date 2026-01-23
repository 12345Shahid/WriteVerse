// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const id = (req.query?.id as string) || (req.url?.split('/')?.filter(Boolean)?.slice(-2)[0] as string);
  const userId = (req.headers['x-user-id'] || req.headers['X-User-Id']) as string | undefined;
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  if (!id) return res.status(400).json({ error: 'INVALID_ID' });

  const winner = (req.body?.winner ?? '').toString().toUpperCase();
  if (!['A','B'].includes(winner)) return res.status(400).json({ error: 'INVALID_REQUEST', message: 'winner must be A or B' });

  try {
    const { data, error } = await supabaseAdmin
      .from('ab_tests')
      .update({ winner })
      .match({ id, user_id: userId })
      .select('*');
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND', message: 'No matching A/B test for this user' });
    return res.json({ test: rows[0] });
  } catch (err: any) {
    console.error('[ABTests][WINNER] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
}
