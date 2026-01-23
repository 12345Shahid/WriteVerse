import { getSupabaseAdmin } from '../../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server misconfigured' });

    const userId = req.headers['x-user-id'];
    const orgId = req.headers['x-organization-id'];
    const { id: brandVoiceId } = req.query;

    if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

    // POST /api/brand-voices/:id/samples
    const { content, source_url, type } = req.body;
    try {
        const { data, error } = await supabaseAdmin
            .from('brand_voice_samples')
            .insert({
                brand_voice_id: brandVoiceId,
                content,
                source_url,
                type: type || 'text'
            })
            .select()
            .single();
        
        if (error) throw error;
        return res.json({ sample: data });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}
