import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];

  if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

  const { id: projectId } = req.query;

  // Common check: User must be member of org
  try {
    const { data: mem } = await supabaseAdmin
      .from('organization_members')
      .select('id, role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    // GET /api/projects/:id
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('projects')
        .select('*, tasks(count), tags:project_tags(tag:tags(*))')
        .eq('id', projectId)
        .eq('organization_id', orgId)
        .single();

      if (error) throw error;

      // Format tags
      const project = {
        ...data,
        tags: data.tags ? data.tags.map((t: any) => t.tag) : [],
      };

      return res.json({ project });
    }

    // PATCH /api/projects/:id
    if (req.method === 'PATCH') {
      const updates = req.body;
      delete updates.id;
      delete updates.organization_id;
      delete updates.created_at;

      const { data, error } = await supabaseAdmin
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .eq('organization_id', orgId)
        .select()
        .single();

      if (error) throw error;
      return res.json({ project: data });
    }

    // DELETE /api/projects/:id
    if (req.method === 'DELETE') {
      // Only admins/owners or creator? Let's say admins or creator.
      // For now, allow any member to delete if RLS allows, but here we are admin.
      // Let's restrict to admin/owner or creator.
      const { data: project } = await supabaseAdmin
        .from('projects')
        .select('created_by')
        .eq('id', projectId)
        .single();
      
      const isCreator = project?.created_by === userId;
      const isAdmin = ['owner', 'admin'].includes(mem.role);

      if (!isCreator && !isAdmin) {
         return res.status(403).json({ error: 'FORBIDDEN', message: 'Only admins or the creator can delete this project.' });
      }

      const { error } = await supabaseAdmin
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('organization_id', orgId);

      if (error) throw error;
      return res.status(204).end();
    }

  } catch (err: any) {
    console.error('[API][projects][ID] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
