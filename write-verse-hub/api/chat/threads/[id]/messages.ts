import { getSupabaseAdmin } from '../../../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];

  if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

  const { id: threadId } = req.query;

  // GET /api/chat/threads/:id/messages
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabaseAdmin
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return res.json({ messages: data });
    } catch (err: any) {
      console.error('[API][chat][MESSAGES] Error', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  }

  // POST /api/chat/threads/:id/messages
  if (req.method === 'POST') {
    const { role = 'user', content } = req.body;
    if (!content) return res.status(400).json({ error: 'MISSING_CONTENT' });

    try {
      const { data, error } = await supabaseAdmin
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          role,
          content,
          user_id: userId // Optional depending on schema, but good to track
        })
        .select()
        .single();

      if (error) throw error;
      return res.json({ message: data });
    } catch (err: any) {
      console.error('[API][chat][SEND] Error', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
