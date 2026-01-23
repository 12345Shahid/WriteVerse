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
  const { sessionId, status } = req.body || {};

  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!sessionId || !status) return res.status(400).json({ error: 'Missing sessionId or status' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'SERVER_CONFIG_ERROR' });

  try {
    console.log('[Agent Status] Updating:', { sessionId, status });

    // Map status to is_escalated flag
    const is_escalated = status === 'escalated';

    const { error } = await supabaseAdmin
      .from('agent_sessions')
      .update({ is_escalated })
      .eq('id', sessionId);

    if (error) {
      console.error('[Agent Status] Error:', error);
      throw error;
    }

    console.log('[Agent Status] Updated successfully');

    res.json({
      success: true,
      sessionId,
      status,
      is_escalated
    });
  } catch (e: any) {
    console.error('[Agent Status] Error:', e);
    res.status(500).json({ error: e.message });
  }
}
