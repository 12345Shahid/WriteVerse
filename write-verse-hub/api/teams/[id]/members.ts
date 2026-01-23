import { getSupabaseAdmin } from '../../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });

  const { id: orgId } = req.query;

  if (req.method === 'GET') {
    try {
      // Security Check: Caller must be a member
      const { data: membership } = await supabaseAdmin
        .from('organization_members')
        .select('role')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle to avoid error if not found
      
      if (!membership) return res.status(403).json({ error: 'FORBIDDEN' });

      // Fetch members with profiles
      const { data: members, error } = await supabaseAdmin
        .from('organization_members')
        .select(`
          id, role, created_at,
          user:users (id, email)
        `)
        .eq('organization_id', orgId);

      if (error) throw error;

      // Flatten structure
      const result = members.map((m: any) => ({
        id: m.id,
        userId: m.user?.id,
        email: m.user?.email || 'Unknown',
        role: m.role,
        joinedAt: m.created_at
      }));

      return res.json({ members: result });
    } catch (err: any) {
      console.error('[Teams][MEMBERS] Error', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err.message) });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
