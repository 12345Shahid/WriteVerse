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

    // GET /api/categories - List categories
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('categories')
        .select('*')
        .eq('organization_id', orgId)
        .order('name');

      if (error) throw error;
      return res.json({ categories: data });
    }

    // POST /api/categories - Create category
    if (req.method === 'POST') {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'MISSING_NAME' });

      // Uniqueness Check
      const { data: existing } = await supabaseAdmin
        .from('categories')
        .select('id')
        .eq('organization_id', orgId)
        .ilike('name', name)
        .maybeSingle();

      if (existing) return res.status(409).json({ error: 'DUPLICATE', message: 'Category name already exists' });

      const { data, error } = await supabaseAdmin
        .from('categories')
        .insert({ organization_id: orgId, name })
        .select()
        .single();

      if (error) throw error;
      return res.json({ category: data });
    }

  } catch (err: any) {
    console.error('[API][categories] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
