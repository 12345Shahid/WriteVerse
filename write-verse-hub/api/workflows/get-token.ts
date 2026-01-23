import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { getUserIdFromHeader } from '../supabaseAdmin.js';

/**
 * Generate JWT token for Latenode embedded SDK
 * 
 * This endpoint creates a signed JWT that authenticates users
 * to the Latenode workflow builder embedded in our platform.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get Latenode secret key
  const secretKey = process.env.LATENODE_SECRET_KEY;
  if (!secretKey) {
    console.error('[API][workflows/get-token] LATENODE_SECRET_KEY not configured');
    return res.status(500).json({ 
      error: 'Latenode not configured',
      message: 'Please add LATENODE_SECRET_KEY to environment variables'
    });
  }

  const requestUserId = getUserIdFromHeader(req);
  const { userId, email, organizationId } = req.body;

  if (!userId || !organizationId) {
    return res.status(400).json({ error: 'userId and organizationId required' });
  }

  try {
    // Create JWT payload
    const payload = {
      // User identification
      userId: userId,
      email: email || '',
      organizationId: organizationId,
      
      // Latenode-specific fields (check their docs for exact requirements)
      sub: userId,
      iss: 'writeverse-hub',
      aud: 'latenode',
      
      // Timestamp
      iat: Math.floor(Date.now() / 1000),
    };

    // Sign the token
    const token = jwt.sign(payload, secretKey, {
      expiresIn: '24h', // Token valid for 24 hours
      algorithm: 'HS256'
    });

    console.log('[API][workflows/get-token] Token generated for:', {
      userId,
      organizationId,
      expiresIn: '24h'
    });

    return res.json({
      token,
      expiresIn: 86400 // 24 hours in seconds
    });
  } catch (err: any) {
    console.error('[API][workflows/get-token] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
