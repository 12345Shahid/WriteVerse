import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const userId = req.headers['x-user-id'];
  const orgIdHeader = req.headers['x-organization-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });

  try {
    // 1. Determine context (Org & Role)
    let targetOrgId = orgIdHeader;
    let role = 'member';

    const { data: mem } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', userId)
      .order('created_at')
      .limit(1)
      .maybeSingle();

    if (!targetOrgId && mem) targetOrgId = mem.organization_id;
    if (mem && mem.organization_id === targetOrgId) role = mem.role;

    // Allow querying by user_id if no org
    const hasOrgFilter = !!targetOrgId;
    const isAdmin = role === 'owner' || role === 'admin';

    // 2. Fetch Usage Events - by org_id if available, otherwise by user_id
    let query = supabaseAdmin
      .from('usage_events')
      .select('tool, credits, created_at, user_id, metadata')
      .order('created_at', { ascending: false })
      .limit(2000);
    
    // Improved query: include events for the user even if they don't have an org_id yet
    if (hasOrgFilter) {
      // If we have an org, we still want to show personal usage that might have been logged without org_id
      query = query.or(`organization_id.eq.${targetOrgId},and(user_id.eq.${userId},organization_id.is.null)`);
    } else {
      // Query solely by user_id if no organization
      query = query.eq('user_id', userId);
    }
    
    const { data: events, error } = await query;

    if (error) throw error;

    // 3. Process Data
    const tools: any = {};
    const workflows: any = {};
    const agents: any = {};
    const embeds: any = {};
    const templates: any = {};

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    (events || []).forEach((ev: any) => {
      const date = new Date(ev.created_at);
      const isRecent = date >= threeMonthsAgo;
      const credits = ev.credits || 0;
      const toolName = ev.tool || 'unknown';
      const isMyUsage = ev.user_id === userId;

      // Categorize
      let category = 'tool';
      let id = toolName;

      if (toolName.startsWith('workflow:')) {
        category = 'workflow';
        id = toolName.replace('workflow:', '');
      } else if (toolName.startsWith('template:')) {
        category = 'template';
        id = toolName.replace('template:', '');
      } else if (toolName.startsWith('agent:')) {
        category = 'agent';
        id = toolName.replace('agent:', '');
        if (!ev.user_id) category = 'embed';
      }

      const bucket = category === 'workflow' ? workflows :
        category === 'template' ? templates :
        category === 'agent' ? agents :
          category === 'embed' ? embeds : tools;

      if (!bucket[id]) {
        bucket[id] = {
          id,
          name: id, // Use id as name for tools (will be overwritten for workflows/agents)
          lastUsed: date,
          lastCredits: credits,
          totalCredits3m: 0,
          totalCredits30d: 0,
          totalCredits7d: 0,
          totalCreditsAll: 0,
          entries: 0,
          userTotal3m: 0,
          userTotal30d: 0,
          userTotal7d: 0,
          userTotalAll: 0
        };
      }
      const item = bucket[id];

      if (date > item.lastUsed) {
        item.lastUsed = date;
        item.lastCredits = credits;
      }
      if (isRecent) item.totalCredits3m += credits;
      if (date >= oneMonthAgo) item.totalCredits30d += credits;
      if (date >= oneWeekAgo) item.totalCredits7d += credits;
      item.totalCreditsAll += credits;
      item.entries++;

      if (isMyUsage) {
        if (isRecent) item.userTotal3m += credits;
        if (date >= oneMonthAgo) item.userTotal30d += credits;
        if (date >= oneWeekAgo) item.userTotal7d += credits;
        item.userTotalAll += credits;
      }
    });

    // 4. Fetch Metadata (Names)
    const workflowIds = Object.keys(workflows);
    const agentIds = [...Object.keys(agents), ...Object.keys(embeds)];

    const [wfRes, agRes] = await Promise.all([
      workflowIds.length ? supabaseAdmin.from('workflows').select('id, name').in('id', workflowIds) : { data: [] },
      agentIds.length ? supabaseAdmin.from('agents').select('id, name').in('id', agentIds) : { data: [] }
    ]);

    const wfMap = new Map((wfRes.data as any[])?.map((w: any) => [w.id, w.name]) || []);
    const agMap = new Map((agRes.data as any[])?.map((a: any) => [a.id, a.name]) || []);

    Object.values(workflows).forEach((w: any) => w.name = wfMap.get(w.id) || 'Unknown Workflow');
    Object.values(agents).forEach((a: any) => a.name = agMap.get(a.id) || 'Unknown Agent');
    Object.values(embeds).forEach((e: any) => e.name = agMap.get(e.id) || 'Unknown Agent');

    // 5. Fetch Storage Stats
    const { data: files } = await supabaseAdmin
      .from('files')
      .select('size')
      .eq('organization_id', targetOrgId);

    const totalStorageBytes = files?.reduce((acc: number, f: any) => acc + (f.size || 0), 0) || 0;

    const { count: kbCount } = await supabaseAdmin
      .from('knowledge_base')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', targetOrgId);

    res.json({
      isAdmin,
      usage: {
        tools: Object.values(tools).sort((a: any, b: any) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()),
        workflows: Object.values(workflows).sort((a: any, b: any) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()),
        agents: Object.values(agents).sort((a: any, b: any) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()),
        embeds: Object.values(embeds).sort((a: any, b: any) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()),
        templates: Object.values(templates).sort((a: any, b: any) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()),
      },
      storage: {
        filesBytes: totalStorageBytes,
        kbCount: kbCount || 0
      }
    });
  } catch (e: any) {
    console.error('[API][analytics][dashboard] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: e.message });
  }
}
