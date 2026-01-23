import { VercelRequest, VercelResponse } from '@vercel/node';

// WorkOS SSO endpoint
// Note: Requires WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const domain = req.query.domain as string;
  const redirect = (req.query.redirect as string) || '/dashboard';

  if (!domain) {
    // Return HTML page with error
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>SSO Error</title>
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
            <h1>⚠️ Domain Required</h1>
            <p>Please provide a company domain for SSO login.</p>
            <p><a href="/auth">← Back to Login</a></p>
          </div>
        </body>
      </html>
    `);
  }

  const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID;

  if (!WORKOS_CLIENT_ID) {
    console.error('[SSO] Missing WorkOS credentials');
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>SSO Error</title>
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
            <h1>⚠️ SSO Not Configured</h1>
            <p>Single Sign-On is not configured for this application. Please contact your administrator.</p>
            <p><a href="/auth">← Back to Login</a></p>
          </div>
        </body>
      </html>
    `);
  }

  try {
    // Construct the WorkOS authorization URL directly (GET request, not POST)
    const baseUrl = 'https://writehubai.halal-solutions.com';
    const callbackUrl = `${baseUrl}/auth/callback`;
    const state = Buffer.from(JSON.stringify({ redirect })).toString('base64');

    // WorkOS SSO uses GET to the authorization endpoint
    const authUrl = new URL('https://api.workos.com/sso/authorize');
    authUrl.searchParams.set('client_id', WORKOS_CLIENT_ID);
    authUrl.searchParams.set('domain', domain);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');

    console.log('[SSO] Redirecting to WorkOS:', authUrl.toString());
    
    return res.redirect(302, authUrl.toString());

  } catch (error: any) {
    console.error('[SSO] Error:', error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>SSO Error</title>
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
            <h1>⚠️ SSO Error</h1>
            <p>SSO is not configured for domain "${domain}".</p>
            <p>Please contact your IT administrator to set up Single Sign-On.</p>
            <p><a href="/auth">← Back to Login</a></p>
          </div>
        </body>
      </html>
    `);
  }
}
