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
  const { sessionId } = req.body || {};

  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'SERVER_CONFIG_ERROR' });

  try {
    console.log('[Agent Close] Closing session:', { sessionId, userId });

    // Mark session as closed (add status column if not exists)
    const { error } = await supabaseAdmin
      .from('agent_sessions')
      .update({ 
        is_escalated: false,
        status: 'closed',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) {
      console.error('[Agent Close] Error:', error);
      // If status column doesn't exist, try without it
      if (error.message?.includes('status')) {
        await supabaseAdmin
          .from('agent_sessions')
          .update({ 
            is_escalated: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId);
      } else {
        throw error;
      }
    }

    console.log('[Agent Close] Session closed successfully');

    res.json({
      success: true,
      sessionId,
      status: 'closed'
    });
  } catch (e: any) {
    console.error('[Agent Close] Error:', e);
    res.status(500).json({ error: e.message });
  }
}
