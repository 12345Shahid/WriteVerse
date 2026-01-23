import { initiateConnection } from '../_lib/composio.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ message: 'NO_USER_ID' });

  const orgId = req.headers['x-organization-id'] || req.headers['X-Organization-Id'];
  const { appName, agentId, redirectUrl } = req.body || {};

  if (!appName) return res.status(400).json({ message: 'Missing appName' });

  try {
    const result = await initiateConnection(String(userId), String(appName), String(redirectUrl || ''));

    if (!result.success) {
      return res.status(400).json({
        message: result.error || 'Connection failed',
        setupRequired: !!result.setupRequired,
      });
    }

    // Best-effort: link this connection to the agent in our DB
    if (agentId && orgId) {
      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin) {
        try {
          await supabaseAdmin
            .from('agent_integrations')
            .upsert(
              {
                agent_id: String(agentId),
                organization_id: String(orgId),
                user_id: String(userId),
                app_name: String(appName).toUpperCase(),
                connection_id: result.connectionId || null,
                connection_status: 'pending',
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'agent_id,app_name' }
            );
        } catch (e: any) {
          console.warn('[API][composio/connect] agent_integrations upsert failed', e?.message || e);
        }
      }
    }

    return res.status(200).json({ authUrl: result.authUrl, connectionId: result.connectionId || null });
  } catch (e: any) {
    return res.status(500).json({ message: String(e?.message || e) });
  }
}
