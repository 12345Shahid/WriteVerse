import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ 
      error: 'MISSING_FIELDS', 
      message: 'Token and password are required' 
    });
  }

  if (password.length < 8) {
    return res.status(400).json({ 
      error: 'WEAK_PASSWORD', 
      message: 'Password must be at least 8 characters' 
    });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  }

  try {
    // 1. Find and validate invitation
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('invitations')
      .select('*, organization:organizations(id, name)')
      .eq('token', token)
      .is('accepted_at', null)
      .single();

    if (inviteError || !invite) {
      return res.status(404).json({ 
        error: 'INVALID_INVITE', 
        message: 'Invitation not found, expired, or already used' 
      });
    }

    // Check expiration
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ 
        error: 'INVITE_EXPIRED', 
        message: 'This invitation has expired' 
      });
    }

    // 2. Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.find((u: any) => u.email === invite.email);

    let userId: string;
    let sessionData: any;

    if (userExists) {
      // User exists - check if they're already in this organization
      const { data: existingMember } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('organization_id', invite.organization_id)
        .eq('user_id', userExists.id)
        .single();

      if (existingMember) {
        return res.status(409).json({
          error: 'ALREADY_MEMBER',
          message: 'You are already a member of this organization. Please login instead.',
          redirectTo: '/login',
        });
      }

      userId = userExists.id;

      // Just add them to the organization (they'll login with existing password)
      await supabaseAdmin
        .from('organization_members')
        .insert({
          organization_id: invite.organization_id,
          user_id: userId,
          role: invite.role,
        });

      // Return message to login instead
      return res.status(200).json({
        ok: true,
        requiresLogin: true,
        message: 'You already have an account. Please login to access your new workspace.',
        email: invite.email,
        redirectTo: '/login',
      });
    } else {
      // 3. Create new user with Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: invite.email,
        password: password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          invited_to_org: invite.organization_id,
          invited_to_org_name: (invite.organization as any)?.name,
        },
      });

      if (authError || !authData.user) {
        console.error('[Setup Password] Auth user creation failed:', authError);
        return res.status(500).json({ 
          error: 'USER_CREATION_FAILED', 
          message: authError?.message || 'Failed to create user account' 
        });
      }

      userId = authData.user.id;

      // 4. Add user to users table (if needed)
      const { error: userInsertError } = await supabaseAdmin
        .from('users')
        .upsert({
          id: userId,
          email: invite.email,
          full_name: invite.email.split('@')[0], // Default name from email
        }, {
          onConflict: 'id',
        });

      if (userInsertError) {
        console.warn('[Setup Password] User table insert failed:', userInsertError);
      }

      // 5. Create session for auto-login
      // Note: We'll let the frontend handle sign-in with the password they just created
      sessionData = null; // Frontend will sign in with email/password
    }

    // 6. Add user to organization_members
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: invite.organization_id,
        user_id: userId,
        role: invite.role,
      });

    if (memberError) {
      console.error('[Setup Password] Member insert failed:', memberError);
      return res.status(500).json({ 
        error: 'MEMBER_INSERT_FAILED', 
        message: 'Failed to add you to the organization' 
      });
    }

    // 7. Mark invitation as accepted
    await supabaseAdmin
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    // 8. Return success with session for auto-login
    return res.status(200).json({
      ok: true,
      session: sessionData,
      organizationId: invite.organization_id,
      organizationName: (invite.organization as any)?.name,
      message: 'Account created successfully!',
      redirectTo: '/dashboard',
    });

  } catch (err: any) {
    console.error('[Setup Password] Error:', err);
    return res.status(500).json({ 
      error: 'INTERNAL_ERROR', 
      message: err.message || 'An unexpected error occurred' 
    });
  }
}
