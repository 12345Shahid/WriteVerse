import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server misconfigured' });

    const userId = req.headers['x-user-id'];
    const orgId = req.headers['x-organization-id'];

    if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

    // GET /api/tags?type=...
    if (req.method === 'GET') {
        const type = req.query.type || 'project';
        try {
            const { data, error } = await supabaseAdmin
                .from('tags')
                .select('*')
                .eq('organization_id', orgId)
                .eq('type', type)
                .order('name');
            
            if (error) throw error;
            return res.json({ tags: data });
        } catch (e: any) {
            console.error('[API][tags][LIST] Error', e);
            return res.status(500).json({ error: 'INTERNAL_ERROR', message: e.message });
        }
    }

    // POST /api/tags (Create)
    if (req.method === 'POST') {
        const { name, color, type } = req.body;
        if (!name || !type) return res.status(400).json({ error: 'Missing name or type' });

        try {
            const { data, error } = await supabaseAdmin
                .from('tags')
                .insert({
                    organization_id: orgId,
                    name,
                    color: color || '#94a3b8',
                    type
                })
                .select()
                .single();
            
            if (error) throw error;
            return res.json({ tag: data });
        } catch (e: any) {
            console.error('[API][tags][CREATE] Error', e);
            return res.status(500).json({ error: 'INTERNAL_ERROR', message: e.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
