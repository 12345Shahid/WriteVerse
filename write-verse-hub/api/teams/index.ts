import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });

  // GET /api/teams -> List user's organizations
  if (req.method === 'GET') {
    try {
      // 1. Get org IDs where user is a member
      const { data: members, error: memberError } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', userId);

      if (memberError) throw memberError;
      if (!members || members.length === 0) return res.json({ teams: [] });

      const orgIds = members.map((m: any) => m.organization_id);

      // 2. Get org details
      const { data: orgs, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .in('id', orgIds)
        .order('created_at', { ascending: false });

      if (orgError) throw orgError;

      // Merge role info
      const result = orgs.map((o: any) => {
        const membership = members.find((m: any) => m.organization_id === o.id);
        return { ...o, role: membership?.role };
      });

      return res.json({ teams: result });
    } catch (err: any) {
      console.error('[Teams][LIST] Error', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err.message) });
    }
  }

  // POST /api/teams -> Create organization
  if (req.method === 'POST') {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'MISSING_NAME' });

    try {
      console.log(`[Teams][CREATE] User ${userId} creating team "${name}"`);

      // Check for duplicate name for this user
      const { data: existingOrgs } = await supabaseAdmin
        .from('organization_members')
        .select('organization:organizations!inner(name)') // Use inner join to ensure organization exists
        .eq('user_id', userId)
        .eq('role', 'owner');

      const hasDuplicate = existingOrgs?.some((m: any) => 
        m.organization?.name?.trim().toLowerCase() === name.trim().toLowerCase()
      );

      if (hasDuplicate) {
        return res.status(400).json({ 
          error: 'DUPLICATE_NAME', 
          message: 'You already own a team with this name.' 
        });
      }

      // Create Org
      const { data: org, error: createError } = await supabaseAdmin
        .from('organizations')
        .insert({ name, seat_limit: 5 })
        .select()
        .single();

      if (createError) {
        console.error('[Teams][CREATE] Failed to insert org', createError);
        throw createError;
      }

      console.log(`[Teams][CREATE] Org created ${org.id}. Adding owner...`);

      // Ensure membership
      const { error: memberError } = await supabaseAdmin
        .from('organization_members')
        .insert({ organization_id: org.id, user_id: userId, role: 'owner' })
        .select();
        
      if (memberError) {
        // If duplicate key error (23505), it means trigger might have worked (unexpectedly) or race condition.
        if (memberError.code === '23505') {
          console.log('[Teams][CREATE] Owner already exists (trigger?)');
        } else {
          console.error('[Teams][CREATE] Failed to add owner member', memberError);
          throw memberError;
        }
      }

      return res.json({ team: { ...org, role: 'owner' } });
    } catch (err: any) {
      console.error('[Teams][CREATE] Error', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err.message || err) });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
