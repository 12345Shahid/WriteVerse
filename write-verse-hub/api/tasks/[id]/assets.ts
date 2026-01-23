import { getSupabaseAdmin } from '../../supabaseAdmin.js';

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

    // GET /api/tasks/:id/assets - List task assets
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('task_assets')
        .select('*, asset:assets(*)')
        .eq('task_id', taskId);

      if (error) throw error;
      const assets = data.map((ta: any) => ta.asset);
      return res.json({ assets });
    }

    // POST /api/tasks/:id/assets - Attach asset to task
    if (req.method === 'POST') {
      const { assetId } = req.body;
      if (!assetId) return res.status(400).json({ error: 'MISSING_ASSET_ID' });

      const { error } = await supabaseAdmin
        .from('task_assets')
        .insert({ task_id: taskId, asset_id: assetId });

      if (error) throw error;
      return res.json({ success: true });
    }

  } catch (err: any) {
    console.error('[API][tasks][assets] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
