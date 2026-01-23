import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server misconfigured' });

  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];

  if (!userId || !orgId) return res.status(400).json({ error: 'MISSING_CONTEXT' });

  // GET /api/projects  -> list projects
  if (req.method === 'GET') {
    try {
      const { data: mem } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .maybeSingle();
      if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

      const { data, error } = await supabaseAdmin
        .from('projects')
        .select('*, tasks(count), tags:project_tags(tag:tags(*))')
        .eq('organization_id', orgId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const projects = (data || []).map((p: any) => ({
        ...p,
        tags: p.tags ? p.tags.map((t: any) => t.tag) : [],
      }));

      return res.json({ projects });
    } catch (err: any) {
      console.error('[API][projects][LIST] Error', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  }

  // POST /api/projects  -> create project
  if (req.method === 'POST') {
    const { name, description, status } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'NAME_REQUIRED', message: 'Project name is required' });
    }

    try {
      const { data: mem } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .maybeSingle();
      if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

      // Uniqueness check (case-insensitive)
      const { data: existing } = await supabaseAdmin
        .from('projects')
        .select('id')
        .eq('organization_id', orgId)
        .ilike('name', name)
        .maybeSingle();

      if (existing) {
        return res
          .status(409)
          .json({ error: 'DUPLICATE', message: 'Project name already exists' });
      }

      const { data, error } = await supabaseAdmin
        .from('projects')
        .insert({
          organization_id: orgId,
          name,
          description,
          status: status || 'active',
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return res.json({ project: data });
    } catch (err: any) {
      console.error('[API][projects][CREATE] Error', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
