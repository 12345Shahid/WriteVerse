import { getSupabaseAdmin } from '../../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });

  const { id: orgId } = req.query;

  if (req.method === 'POST') {
    const { email, role = 'viewer' } = req.body;

    if (!email) return res.status(400).json({ error: 'MISSING_EMAIL' });

    try {
      // Security Check: Caller must be admin/owner
      const { data: caller } = await supabaseAdmin
        .from('organization_members')
        .select('role')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .single();
      
      if (!caller || !['owner', 'admin'].includes(caller.role)) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Only admins can invite' });
      }

      let seatLimit = null;
      try {
        const { data: subRow } = await supabaseAdmin
          .from('organization_subscriptions')
          .select('plan_id')
          .eq('organization_id', orgId)
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
        console.warn('[Teams][INVITE] Seat limit lookup failed', e?.message || e);
      }

      if (seatLimit !== null) {
        const { data: members } = await supabaseAdmin
          .from('organization_members')
          .select('id')
          .eq('organization_id', orgId);
        const memberCount = members ? members.length : 0;
        if (memberCount >= seatLimit) {
          return res.status(403).json({
            error: 'SEAT_LIMIT_REACHED',
            message: 'This workspace has reached the seat limit for its plan.',
          });
        }
      }

      // Check if user already exists in system
      // Ideally we look up public.users by email, but we might not have email in users table accessible 
      // if RLS blocks it. Admin client bypasses RLS.
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        // User exists - can still send invite
        // They'll be prompted to login when clicking the link
      }

      const { data: invite, error } = await supabaseAdmin
        .from('invitations')
        .insert({
          organization_id: orgId,
          email,
          role,
          invited_by: userId
        })
        .select()
        .single();

      if (error) throw error;

      // Get organization details for email
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single();

      const { data: inviter } = await supabaseAdmin
        .from('users')
        .select('email, full_name')
        .eq('id', userId)
        .single();

      // Construct setup link
      const origin = req.headers.origin || 'http://localhost:8080';
      const setupLink = `${origin}/auth/setup-password?token=${invite.token}`;

      // Send invitation email using Supabase Auth
      try {
        await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          redirectTo: setupLink,
          data: {
            team_name: org?.name || 'Team',
            inviter_name: inviter?.full_name || inviter?.email || 'A team member',
            organization_id: orgId,
            role: role,
          },
        });

        console.log('[Teams][INVITE] Email sent to:', email);

        return res.json({ 
          ok: true, 
          message: `Invitation sent to ${email}`,
          invitation: {
            id: invite.id,
            email: invite.email,
            role: invite.role,
            expiresAt: invite.expires_at,
          }
        });
      } catch (emailError: any) {
        console.error('[Teams][INVITE] Email send failed:', emailError);
        
        // Fallback: Return link if email fails
        const inviteLink = setupLink;
        return res.json({ 
          ok: true, 
          invitation: invite, 
          inviteLink,
          message: 'Invitation created. Share this link with the user (email sending failed):',
          emailError: emailError.message
        });
      }
    } catch (err: any) {
      console.error('[Teams][INVITE] Error', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err.message) });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
