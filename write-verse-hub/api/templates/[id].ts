import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server misconfigured' });

  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const { id } = req.query;

  if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // GET /api/templates/:id - Get single template
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('content_templates')
        .select('*')
        .eq('id', id)
        .eq('organization_id', orgId)
        .single();

      if (error) throw error;
      return res.json({ template: data });
    }

    // PUT /api/templates/:id - Update template
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const { name, description, category, icon, schema, prompt_text } = req.body;

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (category !== undefined) updates.category = category;
      if (icon !== undefined) updates.icon = icon;
      if (schema !== undefined) updates.schema = schema;
      if (prompt_text !== undefined) updates.prompt_text = prompt_text;

      const { data, error } = await supabaseAdmin
        .from('content_templates')
        .update(updates)
        .eq('id', id)
        .eq('organization_id', orgId)
        .select()
        .single();

      if (error) throw error;
      return res.json({ template: data });
    }

    // DELETE /api/templates/:id - Delete template
    if (req.method === 'DELETE') {
      const { error } = await supabaseAdmin
        .from('content_templates')
        .delete()
        .eq('id', id)
        .eq('organization_id', orgId);

      if (error) throw error;
      return res.json({ ok: true });
    }

  } catch (err: any) {
    console.error('[API][templates][id] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
