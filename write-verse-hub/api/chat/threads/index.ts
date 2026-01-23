import { getSupabaseAdmin } from '../../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server misconfigured' });

    const userId = req.headers['x-user-id'];
    const orgId = req.headers['x-organization-id'];

    if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

    // GET /api/chat/threads
    if (req.method === 'GET') {
        try {
            // Check if user belongs to org
            const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
            if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

            const { data, error } = await supabaseAdmin
                .from('chat_threads')
                .select('*, created_by_user:users(email)')
                .eq('organization_id', orgId)
                .order('updated_at', { ascending: false });
            
            if (error) throw error;
            return res.json({ threads: data });
        } catch (e: any) {
            console.error('[Chat][THREADS] Error', e);
            return res.status(500).json({ error: 'INTERNAL_ERROR' });
        }
    }

    // POST /api/chat/threads
    if (req.method === 'POST') {
        const { topic } = req.body;
        if (!topic) return res.status(400).json({ error: 'Topic required' });

        try {
            const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
            if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

            // Check duplicates
            const { data: existing } = await supabaseAdmin
                .from('chat_threads')
                .select('id')
                .eq('organization_id', orgId)
                .eq('topic', topic)
                .maybeSingle();
            
            if (existing) {
                return res.status(400).json({ error: 'DUPLICATE_TOPIC', message: 'A chat with this name already exists in the team.' });
            }

            const { data, error } = await supabaseAdmin
                .from('chat_threads')
                .insert({ organization_id: orgId, topic, created_by: userId })
                .select()
                .single();

            if (error) throw error;
            return res.json({ thread: data });
        } catch (e: any) {
            console.error('[Chat][CREATE_THREAD] Error', e);
            return res.status(500).json({ error: 'INTERNAL_ERROR' });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
