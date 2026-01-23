import { VercelRequest, VercelResponse } from '@vercel/node';

// SSO Callback Handler - Handles responses from WorkOS/IdP
// This catches errors when WorkOS can't find the domain or other SSO issues

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { error, error_description, code, state } = req.query;

  // If there's an error from WorkOS
  if (error) {
    console.error('[SSO Callback] Error:', error, error_description);
    
    let errorMessage = 'An error occurred during SSO login';
    let errorDetails = '';
    
    if (error === 'connection_not_found' || String(error_description).includes('not found')) {
      errorMessage = 'SSO Not Configured';
      errorDetails = 'The domain you entered does not have SSO configured. Please contact your IT administrator or use email login instead.';
    } else if (error === 'access_denied') {
      errorMessage = 'Access Denied';
      errorDetails = 'Your organization has denied access. Please contact your IT administrator.';
    } else if (error_description) {
      errorDetails = String(error_description);
    }

    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${errorMessage}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: system-ui, -apple-system, sans-serif; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              min-height: 100vh; 
              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
              padding: 20px;
            }
            .card { 
              background: white; 
              padding: 3rem; 
              border-radius: 16px; 
              box-shadow: 0 20px 40px rgba(0,0,0,0.3); 
              text-align: center; 
              max-width: 450px;
              animation: slideUp 0.5s ease;
            }
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .icon { 
              width: 80px; 
              height: 80px; 
              background: #fee2e2; 
              border-radius: 50%; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              margin: 0 auto 1.5rem;
            }
            .icon svg { width: 40px; height: 40px; color: #dc2626; }
            h1 { color: #1f2937; font-size: 1.5rem; margin-bottom: 1rem; font-weight: 700; }
            p { color: #6b7280; margin-bottom: 1.5rem; line-height: 1.6; }
            .error-code { 
              background: #f3f4f6; 
              padding: 0.5rem 1rem; 
              border-radius: 8px; 
              font-family: monospace; 
              font-size: 0.875rem;
              color: #374151;
              margin-bottom: 1.5rem;
              display: inline-block;
            }
            a { 
              display: inline-block;
              background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); 
              color: white; 
              text-decoration: none; 
              padding: 0.875rem 2rem; 
              border-radius: 10px;
              font-weight: 600;
              transition: transform 0.2s, box-shadow 0.2s;
            }
            a:hover { 
              transform: translateY(-2px); 
              box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
            }
            .secondary { 
              display: block; 
              margin-top: 1rem; 
              color: #6b7280; 
              font-size: 0.875rem; 
              text-decoration: none;
            }
            .secondary:hover { color: #374151; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h1>⚠️ ${errorMessage}</h1>
            <p>${errorDetails}</p>
            ${error ? `<div class="error-code">Error: ${error}</div>` : ''}
            <a href="/auth">← Back to Login</a>
            <a href="mailto:support@writehubai.com" class="secondary">Contact Support</a>
          </div>
        </body>
      </html>
    `);
  }

  // If there's a code (successful SSO), handle token exchange
  if (code) {
    // For now, redirect to auth page - full implementation would exchange code for token
    console.log('[SSO Callback] Received code, should exchange for token');
    
    // Parse state to get redirect URL
    let redirect = '/dashboard';
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(String(state), 'base64').toString());
        redirect = stateData.redirect || '/dashboard';
      } catch (e) {
        console.error('[SSO Callback] Failed to parse state:', e);
      }
    }

    // TODO: Exchange code for WorkOS token and create Supabase session
    // For now, redirect to auth page with message
    return res.redirect(`/auth?sso=pending&redirect=${encodeURIComponent(redirect)}`);
  }

  // No error or code - unknown state
  return res.redirect('/auth');
}
