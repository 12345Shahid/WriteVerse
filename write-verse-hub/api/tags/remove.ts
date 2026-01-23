import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server misconfigured' });

    const userId = req.headers['x-user-id'];
    const orgId = req.headers['x-organization-id'];

    if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { tagId, resourceId, resourceType } = req.body;

    if (!tagId || !resourceId || !resourceType) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        let table = '';
        let idColumn = '';
        
        if (resourceType === 'file') { table = 'file_tags'; idColumn = 'file_id'; }
        else if (resourceType === 'project') { table = 'project_tags'; idColumn = 'project_id'; }
        else if (resourceType === 'agent') { table = 'agent_tags'; idColumn = 'agent_id'; }
        else if (resourceType === 'workflow') { table = 'workflow_tags'; idColumn = 'workflow_id'; }
        else return res.status(400).json({ error: 'Invalid resource type' });

        const { error } = await supabaseAdmin
            .from(table)
            .delete()
            .eq('tag_id', tagId)
            .eq(idColumn, resourceId);

        if (error) throw error;

        return res.json({ ok: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}
