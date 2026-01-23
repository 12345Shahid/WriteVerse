/**
 * API v1 - Generate Content
 * POST /api/v1/generate
 * 
 * Business tier feature: REST API for programmatic content generation
 * 
 * Headers:
 * - Authorization: Bearer <API_KEY>
 * 
 * Body:
 * - tool: string (tool name, e.g., "blog_post", "email_subject")
 * - inputs: object (tool-specific inputs)
 * - options: { tone?: string, brandVoiceId?: string, outputCount?: number }
 * 
 * Rate Limits: 100 req/min, 10,000 req/day (Business tier)
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

// In-memory rate limiter (for serverless, use Redis in production)
const rateLimitMap = new Map<string, { count: number, windowStart: number, dailyCount: number, dayStart: number }>();

const RATE_LIMIT = {
    perMinute: 100,
    perDay: 10000
};

/**
 * Validate API key and return organization info
 */
async function validateApiKey(apiKey: string) {
    if (!supabaseAdmin) {
        console.error('[API v1] Supabase not configured');
        return null;
    }

    const { data, error } = await supabaseAdmin
        .from('organization_api_keys')
        .select('id, organization_id, name, organizations(id, name, subscription_tier)')
        .eq('public_key', apiKey)
        .single();

    if (error || !data) {
        console.warn('[API v1] Invalid API key:', apiKey?.substring(0, 10) + '...');
        return null;
    }

    // Check if organization has Business tier (API access)
    const org = data.organizations as any;
    if (!org || !['business', 'enterprise'].includes(org.subscription_tier?.toLowerCase())) {
        console.warn('[API v1] API access requires Business tier. Org tier:', org?.subscription_tier);
        return { error: 'API_ACCESS_REQUIRES_BUSINESS_TIER', org };
    }

    console.log(`[API v1] Authenticated: ${data.name} (Org: ${org.name})`);
    return { keyId: data.id, orgId: data.organization_id, orgName: org.name };
}

/**
 * Check rate limits
 */
function checkRateLimit(keyId: string): { allowed: boolean, remaining: number, resetIn: number } {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const day = Math.floor(now / 86400000);

    let entry = rateLimitMap.get(keyId);
    
    if (!entry || entry.windowStart !== minute) {
        entry = { count: 0, windowStart: minute, dailyCount: entry?.dayStart === day ? entry.dailyCount : 0, dayStart: day };
    }

    // Check daily limit first
    if (entry.dailyCount >= RATE_LIMIT.perDay) {
        return { allowed: false, remaining: 0, resetIn: 86400 - (now % 86400000) / 1000 };
    }

    // Check per-minute limit
    if (entry.count >= RATE_LIMIT.perMinute) {
        return { allowed: false, remaining: 0, resetIn: 60 - (now % 60000) / 1000 };
    }

    entry.count++;
    entry.dailyCount++;
    rateLimitMap.set(keyId, entry);

    return { allowed: true, remaining: RATE_LIMIT.perMinute - entry.count, resetIn: 60 - (now % 60000) / 1000 };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Use POST' });
    }

    // Extract API key from Authorization header
    const authHeader = req.headers['authorization'] || '';
    const apiKey = authHeader.replace(/^Bearer\s+/i, '');

    if (!apiKey) {
        console.warn('[API v1] Missing Authorization header');
        return res.status(401).json({ 
            error: 'UNAUTHORIZED', 
            message: 'Missing Authorization header. Use: Authorization: Bearer <API_KEY>' 
        });
    }

    // Validate API key
    const authResult = await validateApiKey(apiKey);
    if (!authResult) {
        return res.status(401).json({ error: 'INVALID_API_KEY', message: 'Invalid API key' });
    }
    if ('error' in authResult) {
        return res.status(403).json({ 
            error: authResult.error, 
            message: 'API access requires Business tier subscription. Please upgrade at /subscription' 
        });
    }

    const { keyId, orgId, orgName } = authResult;

    // Check rate limits
    const rateLimit = checkRateLimit(keyId);
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT.perMinute.toString());
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimit.resetIn).toString());

    if (!rateLimit.allowed) {
        console.warn(`[API v1] Rate limit exceeded for ${orgName}`);
        return res.status(429).json({ 
            error: 'RATE_LIMIT_EXCEEDED', 
            message: `Rate limit exceeded. Try again in ${Math.ceil(rateLimit.resetIn)} seconds.` 
        });
    }

    // Parse request body
    const { tool, inputs, options } = req.body || {};

    if (!tool || !inputs) {
        return res.status(400).json({ 
            error: 'INVALID_REQUEST', 
            message: 'Request body must include "tool" and "inputs"' 
        });
    }

    console.log(`[API v1] Generate request: tool=${tool}, org=${orgName}`);

    try {
        // Forward to internal generate endpoint (reuse existing logic)
        const internalRes = await fetch(`${process.env.APP_URL || 'http://localhost:8787'}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': 'api-user', // Special marker for API requests
                'X-Organization-Id': orgId
            },
            body: JSON.stringify({
                tool,
                inputs,
                outputCount: options?.outputCount || 1,
                tone: options?.tone,
                brandVoiceId: options?.brandVoiceId,
                modelId: options?.modelId
            })
        });

        const result = await internalRes.json();

        if (!internalRes.ok) {
            console.error('[API v1] Generation failed:', result);
            return res.status(internalRes.status).json(result);
        }

        // Log API usage (fire and forget, don't block response)
        if (supabaseAdmin) {
            try {
                await supabaseAdmin.from('api_usage_logs').insert({
                    api_key_id: keyId,
                    organization_id: orgId,
                    endpoint: '/api/v1/generate',
                    tool_name: tool,
                    status: 'success',
                    created_at: new Date().toISOString()
                });
            } catch (e: unknown) {
                console.warn('[API v1] Failed to log usage:', (e as Error).message);
            }
        }

        console.log(`[API v1] Success: tool=${tool}, org=${orgName}`);
        return res.status(200).json({
            success: true,
            data: result,
            usage: {
                remaining: rateLimit.remaining,
                limit: RATE_LIMIT.perMinute
            }
        });

    } catch (error: any) {
        console.error('[API v1] Error:', error.message);
        return res.status(500).json({ 
            error: 'INTERNAL_ERROR', 
            message: error.message 
        });
    }
}
