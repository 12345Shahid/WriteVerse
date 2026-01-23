import { runWorkflow } from '../../_lib/workflow-engine.js';
import { getSupabaseAdmin } from '../../_lib/supabase.js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const userId = req.headers['x-user-id'];
    const { id: workflowId } = req.query;
    const inputs = req.body.inputs || {};
    const brandVoiceId = req.body.brandVoiceId;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    let orgId = req.headers['x-organization-id'];

    try {
        if (!orgId) {
             const supabaseAdmin = getSupabaseAdmin();
             if (supabaseAdmin) {
                 const { data: mem } = await supabaseAdmin.from('organization_members')
                     .select('organization_id')
                     .eq('user_id', userId)
                     .limit(1)
                     .maybeSingle();
                 orgId = mem?.organization_id;
             }
        }

        if (!orgId) return res.status(400).json({ error: 'No Organization Found' });

        const result = await runWorkflow(workflowId, userId, orgId, inputs, brandVoiceId);
        res.json(result);
    } catch (e: any) {
        console.error("Workflow Error", e);
        res.status(500).json({ error: e.message });
    }
}
