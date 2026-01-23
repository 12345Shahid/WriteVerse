import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { chatWithAgent } from './agents.js';
import rateLimit from 'express-rate-limit';
import { trackEvent, identifyUser } from './lib/mixpanel.js';

const router = Router();

// Init Admin Client
const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Rate limiter for public chat
const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 50, // 50 messages per hour per IP
  message: { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many messages, please try again later.' },
  keyGenerator: (req) => req.headers['x-forwarded-for'] || req.ip // Use IP
});

// Middleware to validate API Key
async function validateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.body.apiKey || req.query.apiKey;
    
    if (!apiKey) return res.status(401).json({ error: 'MISSING_API_KEY' });
    if (!supabaseAdmin) return res.status(500).json({ error: 'SERVER_CONFIG_ERROR' });

    try {
        const { data, error } = await supabaseAdmin
            .from('organization_api_keys')
            .select('organization_id, name')
            .eq('public_key', apiKey)
            .single();
            
        if (error || !data) {
            return res.status(401).json({ error: 'INVALID_API_KEY' });
        }
        
        req.orgId = data.organization_id;
        next();
    } catch (err) {
        console.error('API Key Validation Error', err);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// Init / Config Endpoint
router.get('/init', validateApiKey, async (req, res) => {
    const { botId } = req.query;
    
    if (!botId) return res.status(400).json({ error: 'MISSING_BOT_ID' });

    try {
        const { data: agent, error } = await supabaseAdmin
            .from('agents')
            .select('id, name, description, model_config, widget_settings') 
            .eq('id', botId)
            .eq('organization_id', req.orgId)
            .single();

        if (error || !agent) return res.status(404).json({ error: 'BOT_NOT_FOUND' });

        // Track Init
        trackEvent('embed_init', botId, { 
            botName: agent.name,
            orgId: req.orgId 
        });

        // Get widget settings from database or use defaults
        const widgetSettings = agent.widget_settings || {};

        // Return config safe for frontend with widget settings
        res.json({
            botId: agent.id,
            botName: widgetSettings.botName || agent.name,
            primaryColor: widgetSettings.primaryColor || '#007AFF',
            startMessage: widgetSettings.welcomeMessage || 'Hello! How can I help you?',
            widgetSettings: widgetSettings
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Helper: Trigger Webhook (Async, fire-and-forget)
async function triggerWebhook(url, payload) {
    if (!url) return;
    try {
        // Don't await to avoid blocking response
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(err => console.warn('[Webhook] Trigger failed', err.message));
    } catch (e) {}
}

// Chat Endpoint
router.post('/chat', chatLimiter, validateApiKey, async (req, res) => {
    const { botId, message, sessionId, attachments, lead, webhooks } = req.body;
    
    if (!botId || (!message && (!attachments || attachments.length === 0))) {
        return res.status(400).json({ error: 'INVALID_REQUEST' });
    }

    try {
        // chatWithAgent(userId, orgId, agentId, ...)
        // Pass userId = null for anonymous/embed users
        const result = await chatWithAgent(null, req.orgId, botId, message || '', sessionId, attachments || []);
        const currentSessionId = result.sessionId;

        // Handle Lead Capture
        if (lead && (lead.email || lead.name) && currentSessionId) {
             await supabaseAdmin.from('agent_sessions').update({
                customer_email: lead.email,
                customer_name: lead.name,
                metadata: lead.metadata || {} // store extra fields if any
             }).eq('id', currentSessionId);

             // Track Lead
             trackEvent('embed_lead_captured', currentSessionId, {
                 botId,
                 email: lead.email,
                 name: lead.name
             });
             if (lead.email) identifyUser(lead.email, { $email: lead.email, $name: lead.name });

             if (webhooks?.onLeadCapture) {
                 triggerWebhook(webhooks.onLeadCapture, {
                     event: 'lead_captured',
                     botId,
                     sessionId: currentSessionId,
                     lead,
                     timestamp: new Date().toISOString()
                 });
             }
        }

        // Track Message
        if (message) {
            trackEvent('embed_message_sent', currentSessionId, {
                botId,
                charCount: message.length
            });
        }

        // Fire Message Webhook
        if (webhooks?.onMessageSent) {
             triggerWebhook(webhooks.onMessageSent, {
                 event: 'message_sent',
                 botId,
                 sessionId: currentSessionId,
                 message,
                 response: result.response,
                 timestamp: new Date().toISOString()
             });
        }
        
        res.json(result);
    } catch (e) {
        console.error('Embed Chat Error', e);
        res.status(500).json({ error: e.message });
    }
});

// Fetch Messages Endpoint (Polling)
router.get('/messages', validateApiKey, async (req, res) => {
    const { sessionId } = req.query;
    
    if (!sessionId) return res.status(400).json({ error: 'MISSING_SESSION_ID' });

    try {
        const { data: messages, error } = await supabaseAdmin
            .from('agent_messages')
            .select('role, content, created_at')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        
        res.json({ messages });
    } catch (e) {
        console.error('Embed Messages Error', e);
        res.status(500).json({ error: e.message });
    }
});

// Proactive Triggers Endpoint
router.get('/triggers', validateApiKey, async (req, res) => {
    const { botId } = req.query;
    
    if (!botId) return res.status(400).json({ error: 'MISSING_BOT_ID' });

    try {
        // Verify agent exists and belongs to this org
        const { data: agent, error: agentErr } = await supabaseAdmin
            .from('agents')
            .select('id')
            .eq('id', botId)
            .eq('organization_id', req.orgId)
            .single();

        if (agentErr || !agent) {
            return res.status(404).json({ error: 'BOT_NOT_FOUND' });
        }

        const { data: triggers, error } = await supabaseAdmin
            .from('agent_proactive_triggers')
            .select('id, url_pattern, message, delay_seconds, is_enabled')
            .eq('agent_id', botId)
            .eq('is_enabled', true);

        if (error) throw error;
        
        res.json({ triggers: triggers || [] });
    } catch (e) {
        console.error('Embed Triggers Error', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;

