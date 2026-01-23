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
        // Map resourceType to table
        let table = '';
        if (resourceType === 'file') table = 'file_tags';
        else if (resourceType === 'project') table = 'project_tags'; // Assuming this exists
        else if (resourceType === 'agent') table = 'agent_tags';
        else if (resourceType === 'workflow') table = 'workflow_tags';
        else return res.status(400).json({ error: 'Invalid resource type' });

        const payload: any = { tag_id: tagId };
        if (resourceType === 'file') payload.file_id = resourceId;
        else if (resourceType === 'project') payload.project_id = resourceId;
        else if (resourceType === 'agent') payload.agent_id = resourceId;
        else if (resourceType === 'workflow') payload.workflow_id = resourceId;

        const { error } = await supabaseAdmin
            .from(table)
            .insert(payload);

        if (error) {
            // Ignore duplicate key error
            if (error.code === '23505') return res.json({ ok: true });
            throw error;
        }

        return res.json({ ok: true });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}
