import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
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
  const filter = (req.query.filter as string) || 'all';
  const agentIdFilter = req.query.agentId as string | undefined;

  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'SERVER_CONFIG_ERROR' });

  try {
    console.log('[Inbox] Fetching sessions:', { userId, filter, agentIdFilter });

    // Get user's organization
    const { data: membership } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of any organization' });
    }

    // Get agents - either specific agent or all agents for org
    let agentIds: string[] = [];
    let allAgents: Array<{id: string, name: string}> = [];
    
    if (agentIdFilter) {
      // Filter by specific agent - verify it belongs to user's org
      const { data: agent } = await supabaseAdmin
        .from('agents')
        .select('id, name')
        .eq('id', agentIdFilter)
        .eq('organization_id', membership.organization_id)
        .single();
      
      if (agent) {
        agentIds = [agent.id];
        allAgents = [agent];
      }
    } else {
      // Get all agents for this organization
      const { data: agents } = await supabaseAdmin
        .from('agents')
        .select('id, name')
        .eq('organization_id', membership.organization_id);
      
      allAgents = agents || [];
      agentIds = allAgents.map(a => a.id);
    }

    if (agentIds.length === 0) {
      return res.json({ sessions: [], total: 0 });
    }

    // Build query for sessions
    let query = supabaseAdmin
      .from('agent_sessions')
      .select(`
        id,
        agent_id,
        title,
        is_escalated,
        status,
        created_at,
        updated_at
      `)
      .in('agent_id', agentIds)
      .order('updated_at', { ascending: false })
      .limit(50);

    // Apply escalation filter - exclude closed sessions for escalated filter
    if (filter === 'escalated') {
      query = query.eq('is_escalated', true).neq('status', 'closed');
    } else if (filter === 'all') {
      // Show all non-closed sessions
      query = query.or('status.is.null,status.neq.closed');
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('[Inbox] Query error:', error);
      throw error;
    }

    // Enrich sessions with agent names and last message
    const enrichedSessions = await Promise.all((sessions || []).map(async (session: any) => {
      const agent = allAgents.find(a => a.id === session.agent_id);
      
      // Get last message
      const { data: lastMessages } = await supabaseAdmin
        .from('agent_messages')
        .select('content, role, created_at')
        .eq('session_id', session.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastMessage = lastMessages?.[0];

      // Determine status: use explicit status if set, otherwise derive from is_escalated
      // Note: is_escalated might be null in DB, so explicitly check for true
      let displayStatus = session.status;
      const isEscalated = session.is_escalated === true; // Explicitly check for true (handles null)
      
      if (!displayStatus || displayStatus === 'open' || displayStatus === 'active') {
        displayStatus = isEscalated ? 'escalated' : 'active';
      }
      
      // Debug log for troubleshooting
      if (isEscalated && displayStatus !== 'escalated') {
        console.log('[Inbox] STATUS MISMATCH:', { 
          sessionId: session.id, 
          is_escalated: session.is_escalated, 
          status: session.status,
          displayStatus 
        });
      }

      return {
        ...session,
        status: displayStatus,
        agentName: agent?.name || 'Unknown Agent',
        lastMessage: lastMessage?.content?.slice(0, 100) || 'No messages',
        lastMessageRole: lastMessage?.role || 'system',
        lastMessageAt: lastMessage?.created_at || session.updated_at,
        updatedAt: session.updated_at
      };
    }));

    console.log('[Inbox] Found sessions:', enrichedSessions.length);

    res.json({
      sessions: enrichedSessions,
      total: enrichedSessions.length,
      filter
    });
  } catch (e: any) {
    console.error('[Inbox] Error:', e);
    res.status(500).json({ error: e.message });
  }
}
