import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromHeader, getSupabaseAdmin } from '../../_lib/supabase.js';

/**
 * API: Proactive Triggers for an Agent
 * GET  /api/agents/[agentId]/triggers - List triggers
 * POST /api/agents/[agentId]/triggers - Create trigger
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { agentId } = req.query;
    const supabase = getSupabaseAdmin();

    if (!supabase) {
        return res.status(500).json({ error: 'Database not configured' });
    }
    if (!agentId || typeof agentId !== 'string') {
        return res.status(400).json({ error: 'Missing agentId' });
    }

    // For POST/PUT/DELETE, require authentication
    if (req.method !== 'GET') {
        const userId = getUserIdFromHeader(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Verify user has access to this agent's org
        const { data: agent, error: agentErr } = await supabase
            .from('agents')
            .select('organization_id')
            .eq('id', agentId)
            .single();
            
        if (agentErr || !agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        
        const { data: membership } = await supabase
            .from('organization_members')
            .select('id')
            .eq('organization_id', agent.organization_id)
            .eq('user_id', userId)
            .maybeSingle();
            
        if (!membership) {
            return res.status(403).json({ error: 'Not a member of this organization' });
        }
    }

    // GET: List triggers
    if (req.method === 'GET') {
        const { data, error } = await supabase
            .from('agent_proactive_triggers')
            .select('*')
            .eq('agent_id', agentId)
            .order('created_at', { ascending: false });
        
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ triggers: data });
    }

    // POST: Create trigger
    if (req.method === 'POST') {
        const { url_pattern, message, delay_seconds, is_enabled } = req.body || {};

        if (!url_pattern || !message) {
            return res.status(400).json({ error: 'url_pattern and message are required' });
        }

        const { data, error } = await supabase
            .from('agent_proactive_triggers')
            .insert({
                agent_id: agentId,
                url_pattern,
                message,
                delay_seconds: delay_seconds ?? 5,
                is_enabled: is_enabled ?? true
            })
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json({ trigger: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
