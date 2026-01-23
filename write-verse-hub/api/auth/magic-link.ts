import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Magic Link SSO Testing Endpoint
// ⚠️ FOR TESTING ONLY - Disable in production by setting ENABLE_MAGIC_LINK=false

const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Toggle this to enable/disable magic link (set in Vercel env vars)
const ENABLE_MAGIC_LINK = process.env.ENABLE_MAGIC_LINK !== 'false'; // Default enabled for testing

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  // Check if magic link is enabled
  if (!ENABLE_MAGIC_LINK) {
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Feature Disabled</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
            .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
            h1 { color: #e53e3e; font-size: 1.5rem; }
            p { color: #666; }
            a { color: #3182ce; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>⚙️ Magic Link Disabled</h1>
            <p>Magic Link login is disabled in production.</p>
            <p>Please use regular SSO or email login.</p>
            <p><a href="/auth">← Back to Login</a></p>
          </div>
        </body>
      </html>
    `);
  }

  const { email } = req.body || {};

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    console.log('[Magic Link] Sending magic link to:', email);

    // Use Supabase's built-in magic link
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: 'https://writehubai.halal-solutions.com/dashboard'
      }
    });

    if (error) {
      console.error('[Magic Link] Error:', error);
      throw error;
    }

    // Also send the actual magic link email
    const { error: signInError } = await supabaseAdmin.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: 'https://writehubai.halal-solutions.com/dashboard',
        shouldCreateUser: true // Create user if doesn't exist
      }
    });

    if (signInError) {
      console.error('[Magic Link] Sign-in OTP error:', signInError);
      throw signInError;
    }

    console.log('[Magic Link] Email sent successfully');

    res.json({
      success: true,
      message: `Magic link sent to ${email}. Check your inbox!`
    });

  } catch (e: any) {
    console.error('[Magic Link] Error:', e);
    res.status(500).json({ error: e.message || 'Failed to send magic link' });
  }
}
