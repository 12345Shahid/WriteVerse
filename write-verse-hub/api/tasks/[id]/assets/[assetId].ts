import { getSupabaseAdmin } from '../../../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const { id: taskId, assetId } = req.query;

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

    // DELETE /api/tasks/:id/assets/:assetId - Detach asset from task
    if (req.method === 'DELETE') {
      const { error } = await supabaseAdmin
        .from('task_assets')
        .delete()
        .eq('task_id', taskId)
        .eq('asset_id', assetId);

      if (error) throw error;
      return res.json({ ok: true });
    }

  } catch (err: any) {
    console.error('[API][tasks][assets][detach] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
