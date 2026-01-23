import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../../_lib/supabase.js';

/**
 * API: Agent Analytics
 * GET /api/agents/[agentId]/analytics
 * 
 * Returns:
 * - totalConversations: Number of sessions
 * - totalMessages: Number of messages
 * - avgMessagesPerSession: Average messages per session
 * - topicsDistribution: Coming soon
 * - escalationRate: % of sessions that were escalated
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

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Total Conversations
        const { count: totalConversations, error: sessErr } = await supabase
            .from('agent_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', agentId);

        if (sessErr) throw sessErr;

        // Total Messages
        const { count: totalMessages, error: msgErr } = await supabase
            .from('agent_messages')
            .select('id', { count: 'exact', head: true })
            .in('session_id', (
                await supabase.from('agent_sessions').select('id').eq('agent_id', agentId)
            ).data?.map((s: any) => s.id) || []);

        // Escalation Rate - use is_escalated boolean
        const { count: escalatedCount, error: escErr } = await supabase
            .from('agent_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', agentId)
            .eq('is_escalated', true);

        // Recent Conversations (last 5) - include is_escalated to derive status
        const { data: rawSessions, error: recentErr } = await supabase
            .from('agent_sessions')
            .select('id, title, customer_email, status, is_escalated, created_at')
            .eq('agent_id', agentId)
            .order('created_at', { ascending: false })
            .limit(5);
        
        // Map sessions with derived status (is_escalated = true means 'escalated')
        const recentSessions = (rawSessions || []).map(s => ({
            ...s,
            status: (s.is_escalated === true) ? 'escalated' : (s.status || 'active')
        }));

        const avgMessagesPerSession = totalConversations && totalConversations > 0 
            ? Math.round((totalMessages || 0) / totalConversations * 10) / 10 
            : 0;
        
        const escalationRate = totalConversations && totalConversations > 0
            ? Math.round((escalatedCount || 0) / totalConversations * 100)
            : 0;

        res.status(200).json({
            totalConversations: totalConversations || 0,
            totalMessages: totalMessages || 0,
            avgMessagesPerSession,
            escalationRate,
            escalatedCount: escalatedCount || 0,
            recentSessions: recentSessions || []
        });
    } catch (e: any) {
        console.error('[Analytics API] Error:', e);
        res.status(500).json({ error: e.message });
    }
}
