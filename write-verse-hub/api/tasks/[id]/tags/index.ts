import { getSupabaseAdmin } from '../../../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const { id: taskId } = req.query;

  if (!userId || !orgId) return res.status(400).json({ error: 'MISSING_CONTEXT' });

  try {
    // Security: Check membership
    const { data: mem } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    // POST /api/tasks/:id/tags - Add tag to task
    if (req.method === 'POST') {
      const { tagId } = req.body;
      if (!tagId) return res.status(400).json({ error: 'MISSING_TAG_ID' });

      const { error } = await supabaseAdmin
        .from('task_tags')
        .insert({ task_id: taskId, tag_id: tagId });

      if (error) {
        // Ignore duplicate key error
        if (error.code === '23505') return res.json({ ok: true });
        throw error;
      }
      return res.json({ ok: true });
    }

    // GET /api/tasks/:id/tags - List task tags
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('task_tags')
        .select('*, tag:tags(*)')
        .eq('task_id', taskId);

      if (error) throw error;
      const tags = data.map((tt: any) => tt.tag);
      return res.json({ tags });
    }

  } catch (err: any) {
    console.error('[API][tasks][tags] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
