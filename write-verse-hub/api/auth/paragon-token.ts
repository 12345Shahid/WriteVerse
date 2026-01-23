import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const userId = req.headers['x-user-id'] as string;
  
  if (!userId) {
    return res.status(401).json({ error: 'NO_USER_ID', message: 'User ID required' });
  }

  const projectId = process.env.PARAGON_PROJECT_ID;
  let signingKey = process.env.PARAGON_SIGNING_KEY;

  if (!projectId || !signingKey) {
    return res.status(503).json({ 
      error: 'PARAGON_NOT_CONFIGURED', 
      message: 'Paragon integration is not configured' 
    });
  }

  try {
    // IMPORTANT: Convert escaped newlines to actual newlines (for PEM format)
    // Paragon's signing key is a PEM private key that requires RS256
    signingKey = signingKey.replace(/\\n/g, '\n');
    if (!signingKey.endsWith('\n')) {
      signingKey = signingKey + '\n';
    }

    const token = jwt.sign(
      {
        sub: userId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
      },
      signingKey,
      { algorithm: 'RS256' }  // Paragon uses RS256, not HS256
    );

    return res.json({ 
      token,
      projectId
    });
  } catch (error: any) {
    console.error('[Paragon][Token] Error:', error);
    return res.status(500).json({ error: 'TOKEN_GENERATION_FAILED', message: error.message });
  }
}
