import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server misconfigured' });

    const userId = req.headers['x-user-id'];
    const orgId = req.headers['x-organization-id'];

    if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.query;

    // PATCH /api/tags/:id (Update)
    if (req.method === 'PATCH') {
        try {
            const { name, color } = req.body;
            const updates: any = {};
            if (name) updates.name = name;
            if (color) updates.color = color;

            const { data, error } = await supabaseAdmin
                .from('tags')
                .update(updates)
                .eq('id', id)
                .eq('organization_id', orgId)
                .select()
                .single();
            
            if (error) throw error;
            return res.json({ tag: data });
        } catch (e: any) {
            console.error('[API][tags][UPDATE] Error', e);
            return res.status(500).json({ error: e.message });
        }
    }

    // DELETE /api/tags/:id
    if (req.method === 'DELETE') {
        try {
            const { error } = await supabaseAdmin
                .from('tags')
                .delete()
                .eq('id', id)
                .eq('organization_id', orgId);
            
            if (error) throw error;
            return res.json({ ok: true });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
