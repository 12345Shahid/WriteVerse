import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const userId = req.headers['x-user-id'] as string;
  const { sessionId, message } = req.body || {};

  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!sessionId || !message) return res.status(400).json({ error: 'Missing sessionId or message' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'SERVER_CONFIG_ERROR' });

  try {
    console.log('[Agent Reply] Sending human reply:', { sessionId, userId });

    // Insert human reply as assistant message with metadata
    const { error } = await supabaseAdmin
      .from('agent_messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content: message,
        metadata: { responded_by: userId, is_human: true }
      });

    if (error) {
      console.error('[Agent Reply] Error:', error);
      throw error;
    }

    // Update session timestamp
    await supabaseAdmin
      .from('agent_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    console.log('[Agent Reply] Sent successfully');

    res.json({
      success: true,
      sessionId
    });
  } catch (e: any) {
    console.error('[Agent Reply] Error:', e);
    res.status(500).json({ error: e.message });
  }
}
