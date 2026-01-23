import { getSupabaseAdmin } from '../../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server misconfigured' });

    const userId = req.headers['x-user-id'];
    const orgId = req.headers['x-organization-id'];
    const { id } = req.query;

    if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

    // GET /api/brand-voices/:id
    if (req.method === 'GET') {
        try {
            const { data, error } = await supabaseAdmin
                .from('brand_voices')
                .select('*, brand_voice_samples(*)')
                .eq('id', id)
                .eq('organization_id', orgId)
                .single();
            
            if (error) throw error;
            if (!data) return res.status(404).json({ error: 'Not found' });
            return res.json({ voice: data });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // PUT /api/brand-voices/:id
    if (req.method === 'PUT') {
        const { name, description, tone_tags, rules } = req.body;
        try {
            const { data, error } = await supabaseAdmin
                .from('brand_voices')
                .update({ name, description, tone_tags, rules })
                .eq('id', id)
                .eq('organization_id', orgId)
                .select()
                .single();
            
            if (error) throw error;
            return res.json({ voice: data });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // DELETE /api/brand-voices/:id
    if (req.method === 'DELETE') {
        try {
            const { error } = await supabaseAdmin
                .from('brand_voices')
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
