import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];

  if (!userId || !orgId) return res.status(400).json({ error: 'MISSING_CONTEXT' });

  // GET /api/assets - List assets with optional filters
  if (req.method === 'GET') {
    const { projectId, folderId, search, type } = req.query;

    try {
      // Security: Check membership
      const { data: mem } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .maybeSingle();
      if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

      let query = supabaseAdmin
        .from('assets')
        .select('*, tags:asset_tags(tag:tags(*))')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      // If search is active, ignore folder filter to search globally
      if (!search) {
        if (folderId && folderId !== 'null') {
          query = query.eq('folder_id', folderId);
        } else if (folderId === 'null') {
          query = query.is('folder_id', null);
        }
      }

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }
      if (type) {
        if (type === 'image') query = query.ilike('file_type', 'image/%');
        else if (type === 'document') query = query.ilike('file_type', '%pdf%');
      }

      const { data, error } = await query;
      if (error) throw error;

      const assets = data.map((a: any) => ({
        ...a,
        tags: a.tags ? a.tags.map((t: any) => t.tag) : []
      }));
      return res.json({ assets });
    } catch (err: any) {
      console.error('[API][assets][LIST] Error', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
