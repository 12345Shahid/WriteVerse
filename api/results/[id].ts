// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export default async function handler(req: any, res: any) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const id = (req.query?.id as string) || (req.url?.split('/')?.filter(Boolean)?.pop() as string);
  const userId = (req.headers['x-user-id'] || req.headers['X-User-Id']) as string | undefined;
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  if (!id) return res.status(400).json({ error: 'INVALID_ID' });

  try {
    const { error } = await supabaseAdmin
      .from('saved_results')
      .delete()
      .match({ id, user_id: userId });
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[Results][DELETE] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
}
