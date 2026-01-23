import { getSupabaseAdmin } from '../supabaseAdmin.js';

/**
 * Send team invitation email using Supabase
 * @param to - Recipient email
 * @param teamName - Name of the organization
 * @param inviterName - Name/email of person who sent invite
 * @param setupLink - Link to password setup page
 */
export async function sendInvitationEmail({
  to,
  teamName,
  inviterName,
  setupLink,
}: {
  to: string;
  teamName: string;
  inviterName: string;
  setupLink: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin client not configured');
  }

  // Using Supabase's built-in auth.admin.inviteUserByEmail
  // This sends an email with a magic link for password setup
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(to, {
    redirectTo: setupLink,
    data: {
      team_name: teamName,
      inviter_name: inviterName,
    },
  });

  if (error) {
    console.error('[Email] Failed to send invitation:', error);
    throw new Error(`Failed to send invitation email: ${error.message}`);
  }

  console.log('[Email] Invitation sent to:', to);
  return data;
}

/**
 * Alternative: Send custom email using external service
 * Uncomment and configure if you want to use Resend/SendGrid instead
 */
/*
export async function sendInvitationEmailCustom({
  to,
  teamName,
  inviterName,
  setupLink,
}: {
  to: string;
  teamName: string;
  inviterName: string;
  setupLink: string;
}) {
  // Example with Resend
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  await resend.emails.send({
    from: 'WriteHub <noreply@yourdomain.com>',
    to: to,
    subject: `You've been invited to join ${teamName} on WriteHub`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited!</h2>
        <p>${inviterName} has invited you to join their workspace "<strong>${teamName}</strong>" on WriteHub.</p>
        
        <p>As a team member, you'll have access to:</p>
        <ul>
          <li>Shared dashboard and generations</li>
          <li>AI-powered content tools</li>
          <li>Team collaboration features</li>
        </ul>
        
        <div style="margin: 30px 0;">
          <a href="${setupLink}" 
             style="background: #000; color: #fff; padding: 12px 24px; 
                    text-decoration: none; border-radius: 4px; display: inline-block;">
            Accept Invitation & Set Password
          </a>
        </div>
        
        <p style="color: #666; font-size: 12px;">
          This invitation expires in 7 days.
        </p>
      </div>
    `,
  });
}
*/

export default sendInvitationEmail;
