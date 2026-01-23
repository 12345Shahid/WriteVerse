// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

function makeSlug() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const id = (req.query?.id as string) || (req.url?.split('/')?.filter(Boolean)?.slice(-2)[0] as string);
  const userId = (req.headers['x-user-id'] || req.headers['X-User-Id']) as string | undefined;
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  if (!id) return res.status(400).json({ error: 'INVALID_ID' });

  try {
    const slug = makeSlug();
    const { data, error } = await supabaseAdmin
      .from('saved_results')
      .update({ is_public: true, public_slug: slug })
      .match({ id, user_id: userId })
      .select('public_slug');
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND', message: 'No matching saved result for this user' });
    return res.json({ public_slug: rows[0]?.public_slug });
  } catch (err: any) {
    console.error('[Results][SHARE] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
}
