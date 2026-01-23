import { getSupabaseAdmin } from '../../supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });

  // Note: Peeking an invite does NOT require authentication (public link)
  // const userId = req.headers['x-user-id']; 

  const { token } = req.query;

  if (req.method === 'GET') {
    try {
      console.log(`[Teams][PEEK] Checking token: ${token}`);
      const { data: invite, error } = await supabaseAdmin
        .from('invitations')
        .select(`
          id, role, email, expires_at, accepted_at,
          organization:organizations (name)
        `)
        .eq('token', token)
        .single();

      if (error || !invite) {
        console.warn('[Teams][PEEK] Invalid token', error);
        return res.status(404).json({ error: 'INVITE_NOT_FOUND', message: 'Invalid invitation.' });
      }

      if (invite.accepted_at) {
        return res.status(410).json({ error: 'INVITE_USED', message: 'Invitation already used.' });
      }
      
      if (new Date(invite.expires_at) < new Date()) {
         return res.status(410).json({ error: 'INVITE_EXPIRED', message: 'Invitation expired.' });
      }

      return res.json({ 
        invite: {
          email: invite.email,
          role: invite.role,
          teamName: (invite.organization as any)?.name || 'Team'
        }
      });
    } catch (err: any) {
      console.error('[Teams][PEEK] Error', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
