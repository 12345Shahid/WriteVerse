import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server misconfigured' });

  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];

  if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // GET /api/templates - List templates
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('content_templates')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.json({ templates: data });
    }

    // POST /api/templates - Create template
    if (req.method === 'POST') {
      const { name, description, category, icon, schema, prompt_text } = req.body;

      if (!name || !prompt_text) {
        return res.status(400).json({ error: 'Missing required fields (name, prompt_text)' });
      }

      const { data, error } = await supabaseAdmin
        .from('content_templates')
        .insert({
          organization_id: orgId,
          name,
          description: description || '',
          category: category || 'custom',
          icon: icon || 'FileText',
          schema: schema || [],
          prompt_text,
        })
        .select()
        .single();

      if (error) throw error;
      return res.json({ template: data });
    }

  } catch (err: any) {
    console.error('[API][templates] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
