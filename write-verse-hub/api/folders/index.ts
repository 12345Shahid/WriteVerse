import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];

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

    // GET /api/folders - List folders
    if (req.method === 'GET') {
      const parentId = req.query.parentId;

      let query = supabaseAdmin
        .from('folders')
        .select('*, tags:folder_tags(tag:tags(*))')
        .eq('organization_id', orgId)
        .order('name', { ascending: true });

      if (parentId && parentId !== 'null') {
        query = query.eq('parent_id', parentId);
      } else {
        query = query.is('parent_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      const folders = data.map((f: any) => ({
        ...f,
        tags: f.tags ? f.tags.map((t: any) => t.tag) : []
      }));
      return res.json({ folders });
    }

    // POST /api/folders - Create folder
    if (req.method === 'POST') {
      const { name, parentId, categoryId } = req.body;
      if (!name) return res.status(400).json({ error: 'MISSING_NAME' });

      // Uniqueness Check
      let q = supabaseAdmin
        .from('folders')
        .select('id')
        .eq('organization_id', orgId)
        .ilike('name', name);
      if (parentId) q = q.eq('parent_id', parentId);
      else q = q.is('parent_id', null);

      const { data: existing } = await q.maybeSingle();
      if (existing) return res.status(409).json({ error: 'DUPLICATE', message: 'Folder name already exists in this location' });

      const { data, error } = await supabaseAdmin
        .from('folders')
        .insert({
          organization_id: orgId,
          name,
          parent_id: parentId || null,
          category_id: categoryId || null
        })
        .select()
        .single();

      if (error) throw error;
      return res.json({ folder: data });
    }

  } catch (err: any) {
    console.error('[API][folders] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
