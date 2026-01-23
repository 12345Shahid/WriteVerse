import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server misconfigured' });

    const userId = req.headers['x-user-id'];
    const orgId = req.headers['x-organization-id'];

    if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

    // GET /api/brand-voices
    if (req.method === 'GET') {
        try {
            const { data, error } = await supabaseAdmin
                .from('brand_voices')
                .select('*')
                .eq('organization_id', orgId)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return res.json({ voices: data });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    // POST /api/brand-voices
    if (req.method === 'POST') {
        const { name, description, tone_tags, rules } = req.body;
        try {
            const { data, error } = await supabaseAdmin
                .from('brand_voices')
                .insert({
                    organization_id: orgId,
                    name,
                    description,
                    tone_tags,
                    rules
                })
                .select()
                .single();
            
            if (error) throw error;
            return res.json({ voice: data });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
