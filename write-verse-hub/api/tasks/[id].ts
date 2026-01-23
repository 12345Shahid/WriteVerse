import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];

  if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

  const { id: taskId } = req.query;

  try {
    // Security: Check membership
    const { data: mem } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    // PATCH /api/tasks/:id
    if (req.method === 'PATCH') {
      const updates = req.body;
      delete updates.id;
      delete updates.project_id;
      delete updates.created_at;

      const { data, error } = await supabaseAdmin
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return res.json({ task: data });
    }

    // DELETE /api/tasks/:id
    if (req.method === 'DELETE') {
      const { error } = await supabaseAdmin
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      return res.status(204).end();
    }

  } catch (err: any) {
    console.error('[API][tasks][UPDATE/DELETE] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
