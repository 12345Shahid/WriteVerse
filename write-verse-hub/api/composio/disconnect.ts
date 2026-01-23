import { disconnectConnection } from '../_lib/composio.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ message: 'NO_USER_ID' });

  const { connectionId, agentId, appName } = req.body || {};
  if (!connectionId) return res.status(400).json({ message: 'Missing connectionId' });

  try {
    const result = await disconnectConnection(String(userId), String(connectionId));
    if (!result.success) {
      return res.status(400).json({ message: result.error || 'Disconnect failed' });
    }

    // Best-effort: unlink from our DB
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      try {
        if (agentId && appName) {
          await supabaseAdmin
            .from('agent_integrations')
            .delete()
            .eq('agent_id', String(agentId))
            .eq('app_name', String(appName).toUpperCase());
        } else {
          await supabaseAdmin
            .from('agent_integrations')
            .delete()
            .eq('connection_id', String(connectionId));
        }
      } catch (e: any) {
        console.warn('[API][composio/disconnect] agent_integrations delete failed', e?.message || e);
      }
    }

    return res.status(200).json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ message: String(e?.message || e) });
  }
}
