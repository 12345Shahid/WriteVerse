import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
}

async function validateApiKey(apiKey: string) {
  if (!apiKey || !supabaseAdmin) return null;
  
  const { data, error } = await supabaseAdmin
    .from('organization_api_keys')
    .select('organization_id, name')
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
  const botId = req.query.botId as string;

  if (!apiKey) return res.status(401).json({ error: 'MISSING_API_KEY' });
  if (!botId) return res.status(400).json({ error: 'MISSING_BOT_ID' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'SERVER_CONFIG_ERROR' });

  const orgId = await validateApiKey(apiKey);
  if (!orgId) return res.status(401).json({ error: 'INVALID_API_KEY' });

  try {
    // Verify agent exists and belongs to this org
    const { data: agent, error: agentErr } = await supabaseAdmin
      .from('agents')
      .select('id')
      .eq('id', botId)
      .eq('organization_id', orgId)
      .single();

    if (agentErr || !agent) {
      return res.status(404).json({ error: 'BOT_NOT_FOUND' });
    }

    const { data: triggers, error } = await supabaseAdmin
      .from('agent_proactive_triggers')
      .select('id, url_pattern, message, delay_seconds, is_enabled')
      .eq('agent_id', botId)
      .eq('is_enabled', true);

    if (error) throw error;
    
    res.json({ triggers: triggers || [] });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
