import { VercelRequest, VercelResponse } from '@vercel/node';

// WordPress integration via Nango - Coming Soon
// The code is ready but requires WordPress OAuth app credentials

const NANGO_SECRET_KEY = process.env.NANGO_SECRET_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Return "Coming Soon" status for now
  // Full integration code is preserved below but disabled until WordPress OAuth is configured

  return res.json({
    success: false,
    comingSoon: true,
    message: 'WordPress integration coming soon! We are finalizing OAuth configuration.',
    connected: false
  });

  /* 
   * FULL INTEGRATION CODE - READY FOR ACTIVATION
   * Uncomment when WordPress OAuth app is configured in Nango
   *
  if (!NANGO_SECRET_KEY) {
    return res.status(500).json({ error: 'Nango not configured' });
  }

  const { Nango } = await import('@nangohq/node');
  const nango = new Nango({ secretKey: NANGO_SECRET_KEY });
  const userId = req.headers['x-user-id'] as string || 'anonymous';
  const { siteUrl } = req.body || {};

  if (req.method === 'POST') {
    try {
      const connection = await nango.connect('wordpress', userId, {
        params: siteUrl ? { site_url: siteUrl } : undefined
      });

      return res.json({
        success: true,
        authUrl: connection.url || connection,
        connectionId: userId
      });
    } catch (err: any) {
      console.error('[API][wordpress/connect] Error:', err);
      return res.status(500).json({ 
        error: err.message,
        details: 'Make sure you have configured WordPress integration in Nango dashboard'
      });
    }
  }

  if (req.method === 'GET') {
    try {
      const connection = await nango.getConnection('wordpress', userId);
      
      return res.json({
        connected: true,
        siteUrl: connection.connection_config?.site_url || null,
        lastSync: connection.updated_at
      });
    } catch (err: any) {
      return res.json({
        connected: false
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
  */
}
