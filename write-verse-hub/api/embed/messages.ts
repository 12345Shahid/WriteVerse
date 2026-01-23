import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
}

async function validateApiKey(apiKey: string) {
  if (!apiKey || !supabaseAdmin) return null;
  
  const { data, error } = await supabaseAdmin
    .from('organization_api_keys')
    .select('organization_id')
    .eq('public_key', apiKey)
    .single();
    
  if (error || !data) return null;
  return data.organization_id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const apiKey = (req.headers['x-api-key'] as string) || (req.query.apiKey as string);
  const sessionId = req.query.sessionId as string;

  if (!apiKey) return res.status(401).json({ error: 'MISSING_API_KEY' });
  if (!sessionId) return res.status(400).json({ error: 'MISSING_SESSION_ID' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'SERVER_CONFIG_ERROR' });

  const orgId = await validateApiKey(apiKey);
  if (!orgId) return res.status(401).json({ error: 'INVALID_API_KEY' });

  try {
    // Get messages for this session
    const { data: messages, error } = await supabaseAdmin
      .from('agent_messages')
      .select('id, role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Embed Messages] Error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      messages: messages || [],
      sessionId
    });
  } catch (e: any) {
    console.error('[Embed Messages] Error:', e);
    res.status(500).json({ error: e.message });
  }
}
