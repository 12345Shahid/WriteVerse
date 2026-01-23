import express from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CLIENT_ID = process.env.ZAPIER_CLIENT_ID;
const CLIENT_SECRET = process.env.ZAPIER_CLIENT_SECRET;

// 1. Authorize Endpoint (Redirects to Frontend)
router.get('/authorize', (req, res) => {
    const { client_id, redirect_uri, state } = req.query;
    
    if (client_id !== CLIENT_ID) return res.status(400).send('Invalid Client ID');
    
    // Redirect to frontend to handle user approval
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    res.redirect(`${frontendUrl}/settings/zapier-connect?redirect_uri=${encodeURIComponent(redirect_uri)}&state=${encodeURIComponent(state)}`);
});

// 2. Token Endpoint (Exchange Code for Token)
router.post('/token', async (req, res) => {
    const { code, client_id, client_secret } = req.body;

    if (client_id !== CLIENT_ID || client_secret !== CLIENT_SECRET) {
        return res.status(401).json({ error: 'Invalid Client Credentials' });
    }

    // Verify Code
    const { data: codeRecord } = await supabase
        .from('oauth_codes')
        .select('*')
        .eq('code', code)
        .single();
        
    if (!codeRecord || new Date() > new Date(codeRecord.expires_at)) {
        return res.status(400).json({ error: 'Invalid or Expired Code' });
    }

    // Generate Access Token
    const accessToken = 'zap_' + crypto.randomBytes(32).toString('hex');
    
    await supabase.from('oauth_access_tokens').insert({
        access_token: accessToken,
        user_id: codeRecord.user_id,
        client_id: client_id,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Long lived for MVP
    });

    // Delete used code
    await supabase.from('oauth_codes').delete().eq('code', code);

    res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 31536000
    });
});

// 3. Approve Endpoint (Called by Frontend after user clicks "Approve")
router.post('/approve', async (req, res) => {
    const { user_id } = req.body;
    // In real app, verify session/JWT here!
    // Assuming req.body contains trusted user_id from middleware for now
    
    if (!user_id) return res.status(401).json({ error: 'Unauthorized' });

    const code = crypto.randomBytes(16).toString('hex');
    
    await supabase.from('oauth_codes').insert({
        code,
        user_id,
        client_id: CLIENT_ID,
        expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 mins
    });

    res.json({ code });
});

// 4. Me Endpoint (Zapier calls this to test connection)
router.get('/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });

    const { data } = await supabase
        .from('oauth_access_tokens')
        .select('user_id')
        .eq('access_token', token)
        .single();

    if (!data) return res.status(401).json({ error: 'Invalid token' });

    res.json({ 
        id: data.user_id,
        name: 'WriterAI User',
        email: 'user@example.com' // We could fetch real email if needed
    });
});

export default router;
