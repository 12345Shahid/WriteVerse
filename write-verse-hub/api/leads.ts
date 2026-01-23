import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id, X-Organization-Id');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const userId = req.headers['x-user-id'] as string;

  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'SERVER_CONFIG_ERROR' });

  try {
    console.log('[Leads] Fetching leads for user:', userId);

    // Get user's organization
    const { data: membership } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of any organization' });
    }

    // Get all agents for this organization
    const { data: agents } = await supabaseAdmin
      .from('agents')
      .select('id, name')
      .eq('organization_id', membership.organization_id);

    const agentIds = (agents || []).map(a => a.id);

    if (agentIds.length === 0) {
      return res.json({ leads: [], total: 0 });
    }

    // Get leads from agent_sessions table (sessions that have email from widget)
    // The title field contains "Embed Chat: email" for embed sessions
    const { data: sessions, error } = await supabaseAdmin
      .from('agent_sessions')
      .select('id, title, agent_id, created_at')
      .in('agent_id', agentIds)
      .like('title', 'Embed Chat:%')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('[Leads] Query error:', error);
      throw error;
    }

    // Parse leads from session titles
    // Format: "Embed Chat: Name <email@example.com>" or "Embed Chat: email@example.com"
    const leads = (sessions || []).map(session => {
      const title = session.title || '';
      // Remove "Embed Chat: " prefix
      const content = title.replace('Embed Chat:', '').trim();
      
      let name: string | null = null;
      let email = content;
      
      // Check for format "Name <email>"
      const angleMatch = content.match(/^(.+?)\s*<(.+@.+)>$/);
      if (angleMatch) {
        name = angleMatch[1].trim();
        email = angleMatch[2].trim();
      }
      
      return {
        id: session.id,
        email: email || 'Anonymous',
        name: name,
        agent_id: session.agent_id,
        agent_name: agents?.find(a => a.id === session.agent_id)?.name || 'Unknown',
        created_at: session.created_at
      };
    }).filter(lead => lead.email && lead.email !== 'Anonymous' && lead.email.includes('@'));

    console.log('[Leads] Found leads:', leads.length);

    res.json({
      leads,
      total: leads.length
    });
  } catch (e: any) {
    console.error('[Leads] Error:', e);
    res.status(500).json({ error: e.message });
  }
}
