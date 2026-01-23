import { getSupabaseAdmin } from '../../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });

  const { id: orgId } = req.query;

  if (req.method === 'GET') {
    try {
      // Security: User must be member of org
      const { data: mem } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .maybeSingle();
        
      if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

      const { data, error } = await supabaseAdmin
        .from('organization_credits')
        .select('balance_credits, total_spent_usd')
        .eq('organization_id', orgId)
        .maybeSingle();
      
      if (error) throw error;

      return res.json({ 
        balance_credits: data?.balance_credits ?? 0,
        total_spent_usd: data?.total_spent_usd ?? 0
      });
    } catch (err: any) {
      console.error('[Teams][CREDITS] Error', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
