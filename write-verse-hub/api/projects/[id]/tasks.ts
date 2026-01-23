import { getSupabaseAdmin } from '../../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];

  if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

  const { id: projectId } = req.query;

  try {
    // Security: Check membership
    const { data: mem } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    // GET /api/projects/:id/tasks
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('tasks')
        .select('*, assignee:users(email)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.json({ tasks: data });
    }

    // POST /api/projects/:id/tasks
    if (req.method === 'POST') {
      const { title, description, status, priority, assignee_id, due_date } = req.body;
      if (!title) return res.status(400).json({ error: 'MISSING_TITLE' });

      const { data, error } = await supabaseAdmin
        .from('tasks')
        .insert({
          project_id: projectId,
          title,
          description,
          status: status || 'todo',
          priority: priority || 'medium',
          assignee_id,
          due_date
        })
        .select()
        .single();

      if (error) throw error;
      return res.json({ task: data });
    }

  } catch (err: any) {
    console.error('[API][tasks][LIST/CREATE] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
