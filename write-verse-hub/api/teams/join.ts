import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });

  if (req.method === 'POST') {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'MISSING_TOKEN' });

    try {
      // 0. Ensure public profile exists (Fix for missing trigger)
      const { data: profile } = await supabaseAdmin.from('users').select('id').eq('id', userId).maybeSingle();
      if (!profile) {
        console.log(`[Teams][JOIN] Missing public profile for ${userId}. Creating...`);
        const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (authError || !authUser) {
          console.error('[Teams][JOIN] Auth user not found', authError);
          return res.status(401).json({ error: 'AUTH_INVALID', message: 'Your session appears invalid or expired. Please Sign Out and Sign In again.' });
        }
        // Create profile
        const { error: createError } = await supabaseAdmin.from('users').insert({ id: userId, email: authUser.email });
        if (createError) {
          // Ignore if race condition
           if (createError.code !== '23505') {
               console.error('[Teams][JOIN] Failed to create profile', createError);
               throw createError;
           }
        }
      }

      // 1. Find Invitation
      const { data: invite, error: inviteError } = await supabaseAdmin
        .from('invitations')
        .select('*')
        .eq('token', token)
        .is('accepted_at', null) // Only unused invites
        .gt('expires_at', new Date().toISOString()) // Not expired
        .single();

      if (inviteError || !invite) {
        return res.status(404).json({ error: 'INVALID_INVITE', message: 'Invitation not found, expired, or already used.' });
      }

      let seatLimit = null;
      try {
        const { data: subRow } = await supabaseAdmin
          .from('organization_subscriptions')
          .select('plan_id')
          .eq('organization_id', invite.organization_id)
          .maybeSingle();
        if (subRow?.plan_id) {
          const { data: plan } = await supabaseAdmin
            .from('subscription_plans')
            .select('seat_limit')
            .eq('id', subRow.plan_id)
            .maybeSingle();
          if (plan && typeof plan.seat_limit === 'number') {
            seatLimit = plan.seat_limit;
          }
        }
      } catch (e: any) {
        console.warn('[Teams][JOIN] Seat limit lookup failed', e?.message || e);
      }

      if (seatLimit !== null) {
        const { data: members } = await supabaseAdmin
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', invite.organization_id);
        const list = members || [];
        const alreadyMember = list.some((m: any) => m.user_id === userId);
        if (!alreadyMember && list.length >= seatLimit) {
          return res.status(403).json({
            error: 'SEAT_LIMIT_REACHED',
            message: 'This workspace has reached the seat limit for its plan.',
          });
        }
      }

      // 2. Add Member
      const { error: memberError } = await supabaseAdmin
        .from('organization_members')
        .insert({
          organization_id: invite.organization_id,
          user_id: userId,
          role: invite.role
        });

      if (memberError) {
        // If already member, just consume invite?
        if (memberError.code !== '23505') throw memberError;
      }

      // 3. Mark Accepted
      await supabaseAdmin
        .from('invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invite.id);

      return res.json({ ok: true, teamId: invite.organization_id });

    } catch (err: any) {
      console.error('[Teams][JOIN] Error', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err.message) });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
