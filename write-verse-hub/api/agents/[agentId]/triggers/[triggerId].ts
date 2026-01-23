import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromHeader, getSupabaseAdmin } from '../../../_lib/supabase.js';

/**
 * API: Individual Proactive Trigger
 * PUT    /api/agents/[agentId]/triggers/[triggerId] - Update trigger
 * DELETE /api/agents/[agentId]/triggers/[triggerId] - Delete trigger
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { agentId, triggerId } = req.query;
    const supabase = getSupabaseAdmin();

    if (!supabase) {
        return res.status(500).json({ error: 'Database not configured' });
    }
    if (!agentId || typeof agentId !== 'string' || !triggerId || typeof triggerId !== 'string') {
        return res.status(400).json({ error: 'Missing agentId or triggerId' });
    }

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

    // PUT: Update trigger
    if (req.method === 'PUT') {
        const { url_pattern, message, delay_seconds, is_enabled } = req.body || {};

        const updatePayload: any = { updated_at: new Date().toISOString() };
        if (url_pattern !== undefined) updatePayload.url_pattern = url_pattern;
        if (message !== undefined) updatePayload.message = message;
        if (delay_seconds !== undefined) updatePayload.delay_seconds = delay_seconds;
        if (is_enabled !== undefined) updatePayload.is_enabled = is_enabled;

        const { data, error } = await supabase
            .from('agent_proactive_triggers')
            .update(updatePayload)
            .eq('id', triggerId)
            .eq('agent_id', agentId)
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ trigger: data });
    }

    // DELETE: Delete trigger
    if (req.method === 'DELETE') {
        const { error } = await supabase
            .from('agent_proactive_triggers')
            .delete()
            .eq('id', triggerId)
            .eq('agent_id', agentId);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
