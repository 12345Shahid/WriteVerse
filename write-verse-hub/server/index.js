import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';
import { Novu } from '@novu/node';
import { recordUsage } from './meter.js';

import { ingestDocument, searchKnowledge } from './knowledge-base.js';
import multer from 'multer';

// Configure Multer for memory storage (direct upload to Supabase)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

import { chatWithAgent } from './agents.js';
import { runWorkflow } from './workflow-engine.js';
import embedApi from './embed-api.js';
import { trackEvent, identifyUser } from './lib/mixpanel.js';
import { OpenRouterClient } from './lib/openrouter.js';
import { generateParagonToken, sendContentGeneratedEvent } from './lib/paragon.js';
import * as composio from './lib/composio.js';
// import zapierAuth from './zapier-auth.js'; // ZAPIER DISABLED (Requires credentials)
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

const app = express();
const PORT = process.env.PORT || 8787;


app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(express.static('public')); // Serve static files

// Initialize Gemini and Supabase admin client
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const openRouter = process.env.OPENROUTER_API_KEY ? new OpenRouterClient(process.env.OPENROUTER_API_KEY) : null;
const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const novu = process.env.NOVU_API_KEY ? new Novu(process.env.NOVU_API_KEY) : null;

const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req, res) => String(req.headers['x-user-id'] || req.ip),
});

const ToolSchema = z.object({
  tool: z.enum([
    'email_subject',
    'resume',
    'cold_email',
    'product_description',
    'job_description',
    'linkedin',
    'social_ad',
    'summarizer',
    'cover_letter',
    'twitter_thread',
    'faq',
    'script',
    'blog_helper',
    'copy_helper',
    'social_helper',
    'email_writer',
    'rewrite_helper',
    // Group 2 long-form tools
    'blog_post',
    'article_from_outline',
    'seo_blog_optimizer',
    'case_study_writer',
    'landing_page_writer',
    'report_writer',
  ]),
  inputs: z.record(z.any()),
  outputCount: z.number().min(1).max(10).optional(),
  tone: z.string().optional(),
  brandVoiceId: z.string().optional(),
  modelId: z.string().optional(),
});

// Public sharing for saved results
app.post('/api/results/:id/share', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  const id = req.params.id;
  function makeSlug() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }
  try {
    const slug = makeSlug();
    const { data, error } = await supabaseAdmin
      .from('saved_results')
      .update({ is_public: true, public_slug: slug })
      .match({ id, user_id: userId })
      .select('public_slug');
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'No matching saved result for this user' });
    }
    res.json({ public_slug: rows[0]?.public_slug });
  } catch (err) {
    console.error('[Results][SHARE] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
});

app.post('/api/results/:id/unshare', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  const id = req.params.id;
  try {
    const { data, error } = await supabaseAdmin
      .from('saved_results')
      .update({ is_public: false, public_slug: null })
      .match({ id, user_id: userId })
      .select('id');
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'No matching saved result for this user' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[Results][UNSHARE] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
});

app.get('/api/public/:slug', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const slug = req.params.slug;
  try {
    const { data, error } = await supabaseAdmin
      .from('saved_results')
      .select('id, tool_name, input_data, results, created_at, is_public, public_slug')
      .eq('public_slug', slug)
      .eq('is_public', true)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ result: data });
  } catch (err) {
    console.error('[Public][GET] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
});

app.get('/api/public-get', async (req, res) => {
  const slug = req.query.slug;
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ message: 'Missing slug' });
  }

  if (!supabaseAdmin) {
    console.error('[Public][GET_ALIAS] Supabase admin not configured');
    return res.status(404).json({ message: 'Not found' });
  }

  try {
    const { data } = await supabaseAdmin
      .from('saved_results')
      .select('id, tool_name, input_data, results, created_at, public_slug')
      .eq('public_slug', slug)
      .eq('is_public', true)
      .single();

    if (!data) {
      return res.status(404).json({ message: 'Not found' });
    }

    return res.json({ result: data });
  } catch (err) {
    console.error('[Public][GET_ALIAS] Error', err);
    return res.status(500).json({ message: String(err?.message || err) });
  }
});

app.post('/api/results-share', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const { id } = req.body || {};
  if (!id) {
    return res.status(400).json({ message: 'Missing id' });
  }

  const slug = `r-${id}`;

  try {
    if (supabaseAdmin && userId) {
      const { data, error } = await supabaseAdmin
        .from('saved_results')
        .update({ is_public: true, public_slug: slug })
        .eq('id', id)
        .eq('user_id', userId)
        .select('public_slug')
        .single();
      if (error) throw error;
      const publicSlug = data?.public_slug || slug;
      console.debug('[Results][SHARE_ALIAS] Shared result', { id, publicSlug });
      return res.json({ public_slug: publicSlug });
    }

    console.debug('[Results][SHARE_ALIAS] Shared result without DB update', { id, slug });
    return res.json({ public_slug: slug });
  } catch (err) {
    console.error('[Results][SHARE_ALIAS] Error', err);
    return res.status(500).json({ message: String(err?.message || err) });
  }
});

app.post('/api/results-unshare', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const { id } = req.body || {};
  if (!id) {
    return res.status(400).json({ message: 'Missing id' });
  }

  try {
    if (supabaseAdmin && userId) {
      const { error } = await supabaseAdmin
        .from('saved_results')
        .update({ is_public: false, public_slug: null })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
    }

    console.debug('[Results][UNSHARE_ALIAS] Unshared result', { id, userId });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[Results][UNSHARE_ALIAS] Error', err);
    return res.status(500).json({ message: String(err?.message || err) });
  }
});

app.post('/api/results-delete', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const { id } = req.body || {};
  if (!id) {
    return res.status(400).json({ message: 'Missing id' });
  }

  try {
    if (supabaseAdmin && userId) {
      const { error } = await supabaseAdmin
        .from('saved_results')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
    }

    console.debug('[Results][DELETE_ALIAS] Deleted result', { id, userId });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[Results][DELETE_ALIAS] Error', err);
    return res.status(500).json({ message: String(err?.message || err) });
  }
});

// A/B tests endpoints
app.get('/api/ab-tests', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  try {
    const { data, error } = await supabaseAdmin
      .from('ab_tests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ tests: data });
  } catch (err) {
    console.error('[ABTests][LIST] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
});

app.post('/api/ab-tests', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  const { tool_name, variant_a, variant_b, input_summary } = req.body || {};
  if (!tool_name || !variant_a || !variant_b) {
    return res.status(400).json({ error: 'INVALID_REQUEST', message: 'tool_name, variant_a, variant_b required' });
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('ab_tests')
      .insert({ user_id: userId, tool_name, input_summary: input_summary || null, variant_a, variant_b })
      .select('*')
      .single();
    if (error) throw error;
    res.json({ test: data });
  } catch (err) {
    console.error('[ABTests][CREATE] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
});

app.post('/api/ab-tests/:id/winner', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  const id = req.params.id;
  const { winner } = req.body || {};
  if (!['A', 'B'].includes(String(winner))) return res.status(400).json({ error: 'INVALID_REQUEST', message: 'winner must be A or B' });
  try {
    const { data, error } = await supabaseAdmin
      .from('ab_tests')
      .update({ winner: String(winner) })
      .match({ id, user_id: userId })
      .select('*');
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'No matching A/B test for this user' });
    }
    res.json({ test: rows[0] });
  } catch (err) {
    console.error('[ABTests][WINNER] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
});

const SaveResultsSchema = z.object({
  tool_name: z.string(),
  input_data: z.any(),
  results: z.any(),
});

async function generateWithRetry(model, prompt, maxAttempts = 3, config) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const req = config
        ? { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: config }
        : prompt;
      const resp = await model.generateContent(req);
      const text = resp.response.text();
      return { text, attempts: attempt };
    } catch (err) {
      const msg = String(err?.message || err);
      const retryable = /ECONNRESET|incomplete envelope|fetch failed|network|connection reset/i.test(msg);
      if (attempt < maxAttempts && retryable) {
        const delay = 250 * Math.pow(2, attempt - 1);
        console.warn(`[Generate][Retry] attempt ${attempt} failed: ${msg}. Retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Unreachable');
}

function collectTextFromInputs(value, bucket) {
  if (value == null) return;
  if (typeof value === 'string') {
    bucket.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectTextFromInputs(v, bucket);
    return;
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value)) collectTextFromInputs(v, bucket);
  }
}

function isUnsafeContent(tool, inputs) {
  // Custom keyword-based safety filter disabled: allow all topics.
  // Any remaining content limitations come from the underlying model/provider.
  return false;
}

const SAFETY_MESSAGE =
  'WriterAI could not generate content for this request. Please try again with different input or try again later.';

function buildSafeResults(tool, inputs) {
  switch (tool) {
    case 'email_subject':
      return [{
        text: SAFETY_MESSAGE,
        openRate: 'N/A',
        trigger: 'Safety Policy',
        charCount: SAFETY_MESSAGE.length,
      }];
    case 'resume':
      return [{
        text: SAFETY_MESSAGE,
        actionVerb: 'N/A',
        score: 'N/A',
      }];
    case 'cold_email':
      return [{
        text: SAFETY_MESSAGE,
        hook: 'Safety Policy',
        tips: [
          'Focus your outreach on legal, ethical products or services.',
          'Avoid topics involving alcohol, weapons, illegal drugs, or explicit adult material.',
          'Reframe your message around positive, constructive value for your audience.',
        ],
        followUps: [],
      }];
    case 'product_description':
      return [{
        text: SAFETY_MESSAGE,
        tone: 'Neutral',
        seoKeywords: [],
        metaDescription: 'This topic is not supported. Please choose a different, positive product or service.',
        cta: 'Please choose a different, positive topic.',
        bullets: [],
      }];
    case 'job_description':
      return {
        roleSummary: SAFETY_MESSAGE,
        responsibilities: [],
        requiredQualifications: [],
        niceToHave: [],
        salaryRange: '',
        culture: '',
        eeoStatement: 'We encourage safe, inclusive, and ethical work environments. Content involving alcohol, weapons, illegal drugs, or explicit adult material is not supported.',
        complianceNotes: [
          'Avoid roles or descriptions centered on harmful or unethical activities.',
          'Keep job descriptions aligned with legal and ethical standards.',
        ],
      };
    case 'linkedin':
      return [{
        text: SAFETY_MESSAGE,
        engagementScore: 'N/A',
        hashtags: '#EthicalContent',
        emojiSuggestions: [],
      }];
    case 'social_ad':
      return [{
        text: SAFETY_MESSAGE,
        platform: String(inputs?.platform || 'generic'),
        predictedCtr: 'N/A',
        trigger: 'Safety Policy',
        charCount: SAFETY_MESSAGE.length,
      }];
    case 'summarizer':
      return {
        summary: SAFETY_MESSAGE,
        readability: 'N/A',
        keyPoints: [],
        keywords: [],
        readingTime: 'N/A',
        timeSaved: 'N/A',
      };
    case 'cover_letter':
      return {
        text: SAFETY_MESSAGE,
        atsScore: 'N/A',
        openingHook: 'This topic is not appropriate for a professional cover letter.',
        closing: 'Please try again with a different role, company, or subject that aligns with ethical guidelines.',
      };
    case 'twitter_thread':
      return {
        tweets: [`1/ ${SAFETY_MESSAGE}`],
        engagementPrediction: 'N/A',
        hashtags: '#EthicalContent',
      };
    case 'faq':
      return {
        items: [{
          question: 'Can I generate content about alcohol, weapons, illegal drugs, or explicit adult material?',
          answer: SAFETY_MESSAGE,
        }],
        seoScore: 'N/A',
        schemaMarkup: '',
      };
    case 'script':
      return {
        segments: [{
          time: '00:00',
          line: SAFETY_MESSAGE,
        }],
        pacingWpm: 0,
        wordCount: SAFETY_MESSAGE.split(/\s+/).filter(Boolean).length,
        readTime: 'N/A',
      };
    case 'blog_helper':
    case 'copy_helper':
    case 'social_helper':
    case 'email_writer':
    case 'rewrite_helper':
    case 'blog_post':
    case 'article_from_outline':
    case 'seo_blog_optimizer':
    case 'case_study_writer':
    case 'landing_page_writer':
    case 'report_writer':
      return [{
        text: SAFETY_MESSAGE,
      }];
    default:
      return SAFETY_MESSAGE;
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'WriterAI backend',
    geminiReady: !!genAI,
    supabaseReady: !!supabaseAdmin,
    time: new Date().toISOString(),
  });
});

// Paragon Token Endpoint - Generate JWT for frontend authentication
app.get('/api/auth/paragon-token', async (req, res) => {
  const userId = req.headers['x-user-id'];
  
  if (!userId) {
    return res.status(401).json({ error: 'NO_USER_ID', message: 'User ID required' });
  }

  if (!process.env.PARAGON_PROJECT_ID || !process.env.PARAGON_SIGNING_KEY) {
    return res.status(503).json({ 
      error: 'PARAGON_NOT_CONFIGURED', 
      message: 'Paragon integration is not configured' 
    });
  }

  try {
    const token = await generateParagonToken(userId);
    return res.json({ 
      token,
      projectId: process.env.PARAGON_PROJECT_ID
    });
  } catch (error) {
    console.error('[Paragon][Token] Error:', error);
    return res.status(500).json({ error: 'TOKEN_GENERATION_FAILED', message: error.message });
  }
});

// ============================================
// COMPOSIO INTEGRATION ENDPOINTS
// ============================================

// Health check for Composio
app.get('/api/composio/health', async (req, res) => {
  try {
    const health = await composio.healthCheck();
    return res.json(health);
  } catch (error) {
    console.error('[Composio][Health] Error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// List available apps from Composio
app.get('/api/composio/apps', async (req, res) => {
  try {
    const result = await composio.getAvailableApps();
    if (!result.success) {
      return res.status(503).json({ error: 'COMPOSIO_ERROR', message: result.error });
    }
    return res.json({ apps: result.apps });
  } catch (error) {
    console.error('[Composio][Apps] Error:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Get tools for a specific app
app.get('/api/composio/apps/:appName/tools', async (req, res) => {
  const { appName } = req.params;
  try {
    const result = await composio.getAppTools(appName.toUpperCase());
    if (!result.success) {
      return res.status(503).json({ error: 'COMPOSIO_ERROR', message: result.error });
    }
    return res.json({ tools: result.tools });
  } catch (error) {
    console.error('[Composio][Tools] Error:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Get user's connected accounts
app.get('/api/composio/connections', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'NO_USER_ID', message: 'User ID required' });
  }

  try {
    const result = await composio.getConnectedAccounts(userId);
    return res.json({ accounts: result.accounts });
  } catch (error) {
    console.error('[Composio][Connections] Error:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Initiate OAuth connection to an app
app.post('/api/composio/connect', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const { appName, redirectUrl, agentId } = req.body || {};

  if (!userId) {
    return res.status(401).json({ error: 'NO_USER_ID', message: 'User ID required' });
  }
  if (!appName) {
    return res.status(400).json({ error: 'MISSING_APP', message: 'appName is required' });
  }

  try {
    const result = await composio.initiateConnection(userId, appName.toUpperCase(), redirectUrl);
    if (!result.success) {
      return res.status(503).json({ error: 'CONNECTION_FAILED', message: result.error, setupRequired: result.setupRequired });
    }

    // If agentId is provided, also store in agent_integrations
    // This links the Composio connection to the specific agent
    if (agentId && supabaseAdmin && result.connectionId) {
      try {
        await supabaseAdmin
          .from('agent_integrations')
          .upsert({
            agent_id: agentId,
            organization_id: orgId,
            app_name: appName.toUpperCase(),
            connection_id: result.connectionId,
            connection_status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'agent_id,app_name' });
        console.log('[Composio] Stored agent integration link:', { agentId, appName });
      } catch (dbError) {
        console.warn('[Composio] Failed to store agent integration:', dbError.message);
      }
    }

    return res.json({ 
      authUrl: result.authUrl,
      connectionId: result.connectionId
    });
  } catch (error) {
    console.error('[Composio][Connect] Error:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Disconnect an app
app.post('/api/composio/disconnect', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const { connectionId } = req.body || {};

  if (!userId) {
    return res.status(401).json({ error: 'NO_USER_ID', message: 'User ID required' });
  }
  if (!connectionId) {
    return res.status(400).json({ error: 'MISSING_CONNECTION', message: 'connectionId is required' });
  }

  try {
    const result = await composio.disconnectApp(userId, connectionId);
    if (!result.success) {
      return res.status(503).json({ error: 'DISCONNECT_FAILED', message: result.error });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('[Composio][Disconnect] Error:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Link an existing Composio connection to an agent
// Link an existing Composio connection to an agent
app.post('/api/composio/link-agent', async (req, res) => {
  const userId = req.headers['x-user-id'];
  let orgId = req.headers['x-organization-id'];
  const { agentId, appName, connectionId } = req.body || {};

  if (!userId || !agentId || !appName) {
    return res.status(400).json({ error: 'MISSING_PARAMS', message: 'agentId and appName required' });
  }

  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'DB_NOT_CONFIGURED' });
    }

    // Lookup Org ID if missing or placeholder
    if (!orgId || orgId === 'YOUR_ORG_ID') {
      const { data: mem } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      
      if (mem) {
        orgId = mem.organization_id;
        console.log('[Composio][Link] Resolved Org ID:', orgId);
      } else {
        return res.status(400).json({ error: 'ORG_NOT_FOUND', message: 'Could not resolve Organization ID for user' });
      }
    }

    const { error } = await supabaseAdmin
      .from('agent_integrations')
      .upsert({
        agent_id: agentId,
        organization_id: orgId,
        user_id: userId, // Include user_id as it is good practice, though nullable
        app_name: appName.toUpperCase(),
        connection_id: connectionId || null,
        connection_status: 'connected',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'agent_id,app_name' });

    if (error) {
      console.error('[Composio][LinkAgent] DB Error:', error);
      return res.status(500).json({ error: 'DB_ERROR', message: error.message, details: error });
    }

    console.log('[Composio] Linked agent to app:', { agentId, appName });
    return res.json({ success: true, orgId });
  } catch (error) {
    console.error('[Composio][LinkAgent] Error:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Execute a tool manually (for testing)
app.post('/api/composio/execute', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const { toolName, params } = req.body || {};

  if (!userId) {
    return res.status(401).json({ error: 'NO_USER_ID', message: 'User ID required' });
  }
  if (!toolName) {
    return res.status(400).json({ error: 'MISSING_TOOL', message: 'toolName is required' });
  }

  try {
    const result = await composio.executeTool(userId, toolName, params || {}, {
      source: 'api',
      orgId
    });

    // Log execution to database if configured
    if (supabaseAdmin && orgId) {
      try {
        await supabaseAdmin.rpc('log_tool_execution', {
          p_organization_id: orgId,
          p_user_id: userId,
          p_source_type: 'api',
          p_source_id: null,
          p_source_name: 'Manual API Call',
          p_tool_name: toolName,
          p_app_name: toolName.split('_')[0],
          p_input_params: params || {},
          p_output_result: result.result || null,
          p_status: result.success ? 'success' : 'error',
          p_error_message: result.error || null,
          p_error_code: result.errorCode || null,
          p_execution_time_ms: result.executionTime || null
        });
      } catch (logError) {
        console.warn('[Composio][Execute] Failed to log execution:', logError.message);
      }
    }

    if (!result.success) {
      return res.status(503).json({ 
        error: 'EXECUTION_FAILED', 
        message: result.error,
        code: result.errorCode,
        executionTime: result.executionTime
      });
    }

    return res.json({ 
      success: true,
      result: result.result,
      executionTime: result.executionTime
    });
  } catch (error) {
    console.error('[Composio][Execute] Error:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Create confirmed user (admin) for local dev parity with serverless

app.post('/api/auth/create-confirmed', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Missing email or password' });
    }
    const baseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
    if (!baseUrl || !serviceKey) {
      return res.status(500).json({ message: 'Server not configured' });
    }
    const endpoint = `${baseUrl}/auth/v1/admin/users`;
    const payload = {
      email,
      password,
      email_confirm: true,
      ...(name ? { user_metadata: { name } } : {}),
    };
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
      body: JSON.stringify(payload),
    });
    const json = await r.json().catch(() => null);
    if (!r.ok) {
      // If user already exists, attempt to confirm via PATCH
      if (r.status === 409 || /already/i.test(String(json?.message || ''))) {
        const getResp = await fetch(`${endpoint}?email=${encodeURIComponent(email)}`, {
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
          },
        });
        const getJson = await getResp.json().catch(() => null);
        const user = Array.isArray(getJson?.users) ? getJson.users[0] : (getJson || null);
        const userId = user?.id;
        if (getResp.ok && userId) {
          const patch = await fetch(`${endpoint}?id=${encodeURIComponent(userId)}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': serviceKey,
            },
            body: JSON.stringify({ email_confirm: true }),
          });
          const patchJson = await patch.json().catch(() => null);
          if (!patch.ok) {
            return res.status(patch.status).json({ message: 'Admin PATCH error', details: patchJson });
          }
          return res.status(200).json({ user: patchJson });
        }
      }
      return res.status(r.status).json({ message: 'Admin API error', details: json });
    }
    return res.status(200).json({ user: json });
  } catch (e) {
    console.error('[Auth][create-confirmed] error', e);
    return res.status(500).json({ message: e?.message || 'Internal error' });
  }
});

// Debug endpoint to verify env presence and admin reachability locally
app.get('/api/auth/debug', async (req, res) => {
  try {
    const baseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
    const env = { hasSupabaseUrl: !!baseUrl, hasServiceRole: !!serviceKey };
    let adminPing = { ok: false, status: 0, note: '' };
    if (env.hasSupabaseUrl && env.hasServiceRole) {
      try {
        const r = await fetch(`${baseUrl}/auth/v1/admin/users?limit=1`, {
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
        });
        adminPing = { ok: r.ok, status: r.status, note: r.ok ? 'Admin API reachable' : 'Admin API denied' };
      } catch (e) {
        adminPing = { ok: false, status: 0, note: String(e?.message || 'fetch failed') };
      }
    } else {
      adminPing = { ok: false, status: 0, note: 'Missing envs' };
    }
    return res.json({ env, adminPing });
  } catch (e) {
    return res.status(500).json({ message: e?.message || 'Internal error' });
  }
});

app.post('/api/generate', generateLimiter, async (req, res) => {
  const t0 = Date.now();
  console.log('[Generate] Incoming request');

  const parsed = ToolSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error('[Generate] Validation failed', parsed.error.flatten());
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      message: 'Invalid inputs',
      details: parsed.error.flatten(),
      debug: { received: req.body },
    });
  }

  if (!genAI) {
    console.error('[Generate] GEMINI_API_KEY missing');
    return res.status(500).json({
      error: 'MISSING_GEMINI_API_KEY',
      message: 'Backend not configured with GEMINI_API_KEY',
      debug: { envHasKey: !!process.env.GEMINI_API_KEY },
    });
  }

  const { tool, inputs, outputCount = 3, tone, brandVoiceId, modelId } = parsed.data;

  if (isUnsafeContent(tool, inputs)) {
    const formatted = buildSafeResults(tool, inputs);
    const t1 = Date.now();
    return res.json({
      results: formatted,
      debug: { tool, durationMs: t1 - t0, model: 'safety-filter', blocked: true },
    });
  }

  // Determine Model & Multiplier
  let provider = 'google';
  let selectedModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  let multiplier = 1.0;

  if (modelId && supabaseAdmin) {
      try {
          const { data: modelData } = await supabaseAdmin
              .from('ai_models')
              .select('provider, credit_multiplier')
              .eq('id', modelId)
              .single();
          
          if (modelData) {
              provider = modelData.provider;
              selectedModel = modelId;
              multiplier = modelData.credit_multiplier || 1.0;
          }
      } catch (e) {
          console.warn('[Generate] Model lookup failed', e);
      }
  }

  // Optional credits enforcement (no-op if credits columns are absent)
  const TOOL_CREDIT_COST = {
    email_subject: 1,
    resume: 2,
    cold_email: 3,
    product_description: 3,
    job_description: 5,
    linkedin: 2,
    social_ad: 2,
    summarizer: 1,
    cover_letter: 3,
    twitter_thread: 2,
    faq: 2,
    script: 3,
    blog_helper: 2,
    copy_helper: 2,
    social_helper: 2,
    email_writer: 2,
    rewrite_helper: 2,
    // Group 2 long-form tools (higher credit cost)
    blog_post: 8,
    article_from_outline: 6,
    seo_blog_optimizer: 5,
    case_study_writer: 7,
    landing_page_writer: 7,
    report_writer: 9,
  };
  const baseCredits = TOOL_CREDIT_COST[tool] ?? 1;
  const creditsCharged = Math.ceil(baseCredits * multiplier);

  // Organization & Credit Check
  let orgId = req.headers['x-organization-id'];
  const userId = req.headers['x-user-id'];

  if (supabaseAdmin && userId) {
    try {
      if (!orgId) {
        // Fallback to personal workspace (owner role)
        const { data: mem } = await supabaseAdmin
           .from('organization_members')
           .select('organization_id')
           .eq('user_id', userId)
           .eq('role', 'owner')
           .limit(1)
           .maybeSingle();
         if (mem) orgId = mem.organization_id;
      }

      if (!orgId) {
        // If still no org, we can't proceed with billing.
        // For migration safety, we could optionally allow it but let's be strict.
        return res.status(400).json({ error: 'NO_ORG_SELECTED', message: 'No active workspace found.' });
      }

      const { data: orgCreds, error: credError } = await supabaseAdmin
        .from('organization_credits')
        .select('balance_credits')
        .eq('organization_id', orgId)
        .maybeSingle();
      
      if (credError) throw credError;

      const balance = orgCreds?.balance_credits ?? 0;

      if (balance < creditsCharged) {
        return res.status(402).json({
          error: 'INSUFFICIENT_CREDITS',
          message: 'Workspace has insufficient credits.',
          debug: { required: creditsCharged, balance },
        });
      }
    } catch (e) {
      console.warn('[Credits] Enforcement check skipped/failed', e?.message || e);
    }
  }

  try {
    // Inject Brand Voice
    let brandContext = '';
    if (brandVoiceId && supabaseAdmin) {
        try {
          const { data: voice } = await supabaseAdmin
              .from('brand_voices')
              .select('*, brand_voice_samples(*)')
              .eq('id', brandVoiceId)
              .single();
          
          if (voice) {
              const rules = voice.rules || {};
              const dos = Array.isArray(rules.dos) ? rules.dos.join(', ') : '';
              const donts = Array.isArray(rules.donts) ? rules.donts.join(', ') : '';
              const samples = voice.brand_voice_samples?.map(s => s.content).join('\n---\n') || '';

              brandContext = `\n\n*** BRAND VOICE INSTRUCTIONS ***\nYou must adhere to the following Brand Voice profile:\n- Name: ${voice.name}\n- Description: ${voice.description || 'N/A'}\n- Tone: ${voice.tone_tags?.join(', ') || 'N/A'}\n- DO: ${dos}\n- DON'T: ${donts}\n\n${samples ? `Style Samples (emulate this writing style):\n${samples}\n` : ''}*** END BRAND VOICE ***\n\n`;
          }
        } catch (e) {
            console.warn('[Generate] Failed to fetch brand voice', e);
        }
    }

    let model;
    if (provider === 'openrouter' && openRouter) {
        model = openRouter.getGenerativeModel({ model: selectedModel });
    } else if (genAI) {
        // Strip 'google/' prefix for direct Google API usage
        const cleanModel = selectedModel.replace(/^google\//, '');
        model = genAI.getGenerativeModel({ model: cleanModel }, { apiVersion: 'v1' });
    } else {
        throw new Error('No AI Provider configured for ' + provider);
    }

    const prompt = buildPrompt(tool, inputs, outputCount, tone) + brandContext;
    const finalPrompt = `${prompt}\n\nReturn strictly valid JSON. Do not include code fences.`;

    // Dynamic max token limit based on length input
    let maxOutputTokens = 8192;
    if (tool === 'blog_post' || tool === 'article_from_outline') {
      // 'medium' -> ~2500 tokens (~1500 words)
      if (inputs.length === 'medium') maxOutputTokens = 2500;
    }

    const { text, attempts } = await generateWithRetry(model, finalPrompt, 3, { maxOutputTokens });

    let parsedJson = null;
    try {
      parsedJson = JSON.parse(text);
    } catch (e) {
      const match = text.match(/\[.*\]|\{.*\}/s);
      if (match) {
        try { parsedJson = JSON.parse(match[0]); } catch (err) { parsedJson = null; }
      }
    }

    const longFormTools = new Set([
      'blog_post',
      'article_from_outline',
      'seo_blog_optimizer',
      'case_study_writer',
      'landing_page_writer',
      'report_writer',
    ]);

    if (!parsedJson && longFormTools.has(tool)) {
      const safeRaw = stripBasicMarkdown(String(text || ''));
      switch (tool) {
        case 'blog_post':
          parsedJson = {
            title: String((inputs && inputs.topic) || 'Draft blog post'),
            slug_suggestion: '',
            outline: [],
            body: safeRaw,
            meta_description: '',
          };
          break;
        case 'article_from_outline':
          parsedJson = {
            title: String((inputs && inputs.topic) || 'Draft article'),
            outline: [],
            body: safeRaw,
          };
          break;
        case 'seo_blog_optimizer':
          parsedJson = {
            optimized_title: String((inputs && inputs.topic) || 'Optimized article'),
            optimized_meta_description: '',
            optimized_body: safeRaw,
            suggested_headings: [],
            keyword_usage_notes: [],
            improvements_summary: '',
          };
          break;
        case 'case_study_writer':
          parsedJson = {
            headline: String((inputs && inputs.clientName) || 'Case study'),
            summary: '',
            background: '',
            challenge: '',
            solution: '',
            results: safeRaw,
            quote: '',
          };
          break;
        case 'landing_page_writer':
          parsedJson = {
            hero_headline: String((inputs && inputs.benefit) || 'Landing page draft'),
            hero_subheadline: '',
            hero_cta: '',
            sections: [
              {
                title: 'Main Content',
                body: safeRaw,
              },
            ],
            faq_items: [],
          };
          break;
        case 'report_writer':
          parsedJson = {
            title: String((inputs && inputs.topic) || 'Report'),
            abstract: '',
            sections: [
              {
                heading: 'Main Content',
                body: safeRaw,
              },
            ],
          };
          break;
      }
    }

    if (!parsedJson) {
      console.error('[Generate] JSON parse failed', { preview: text.slice(0, 300) });
      return res.status(502).json({
        error: 'BAD_MODEL_OUTPUT',
        message: 'Model did not return valid JSON'
      });
    }

    // Deduct Credits & Record Usage
    if (supabaseAdmin && userId && orgId) {
      // Approx tokens: 1 token ~= 4 chars
      const estimatedTokens = Math.ceil((text.length + finalPrompt.length) / 4);
      
      try {
        await recordUsage({
          organization_id: orgId,
          user_id: userId,
          tool,
          provider: provider,
          action: 'generate',
          units: estimatedTokens,
          credits: creditsCharged,
          metadata: { model: selectedModel, attempts }
        });
        console.log(`[Credits] Deducted ${creditsCharged} from org ${orgId}`);
        
        // Mixpanel Tracking
        trackEvent('tool_used', userId, {
            tool,
            orgId,
            credits: creditsCharged,
            model: selectedModel,
            tokenCount: estimatedTokens
        });

        // Paragon Integration - Send content generated event
        // This triggers workflows connected to user's integrations (Notion, Slack, etc.)
        const contentTitle = inputs.topic || inputs.title || `Generated ${tool} content`;
        sendContentGeneratedEvent(userId, tool, contentTitle, text, {
          orgId,
          model: selectedModel,
          creditsUsed: creditsCharged
        }).catch(e => console.warn('[Paragon] Event send failed:', e.message));

        // Composio Integration - Push content to connected destinations
        // This is handled separately from Paragon for users with Composio integrations
        if (composio.isComposioEnabled()) {
          try {
            // Check if user has configured output destinations for this tool
            const { data: outputConfigs } = await supabaseAdmin
              .from('tool_output_destinations')
              .select('*')
              .eq('organization_id', orgId)
              .eq('tool_name', tool)
              .eq('is_enabled', true);

            if (outputConfigs?.length > 0) {
              for (const config of outputConfigs) {
                composio.executeTool(userId, config.action_name, {
                  ...config.action_params,
                  content: text,
                  title: contentTitle,
                  tool: tool
                }, {
                  source: 'tool_output',
                  orgId
                }).catch(e => console.warn('[Composio] Output sync failed:', e.message));
              }
              console.log(`[Composio] Triggered ${outputConfigs.length} output destinations for ${tool}`);
            }
          } catch (e) {
            console.warn('[Composio] Output sync check failed:', e.message);
          }
        }

      } catch (e) {
        console.warn('[Credits] Deduction failed', e?.message || e);
      }
    }

    const t1 = Date.now();
    const formatted = formatResults(tool, parsedJson);

    return res.json({
      results: formatted,
      debug: { tool, durationMs: t1 - t0, model: selectedModel, creditsCharged, attemptsUsed: attempts },
    });

  } catch (err) {
    console.error('[Generate] Error', err);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Generation failed',
      debug: {
        message: err?.message,
        stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
      },
    });
  }

});

app.post('/api/workflows/:id/execute', async (req, res) => {
  const workflowId = req.params.id;
  const userId = req.headers['x-user-id'];
  const inputs = req.body.inputs || {};

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Resolve Org ID
    let orgId = req.headers['x-organization-id'];
    if (!orgId && supabaseAdmin) {
       const { data: mem } = await supabaseAdmin.from('organization_members')
         .select('organization_id')
         .eq('user_id', userId)
         .limit(1)
         .maybeSingle();
       orgId = mem?.organization_id;
    }
    if (!orgId) return res.status(400).json({ error: 'No Organization Found' });

    // Run workflow (awaiting for MVP simplicity)
    const result = await runWorkflow(workflowId, userId, orgId, inputs);
    
    trackEvent('workflow_executed', userId, {
        workflowId,
        orgId
    });

    res.json(result);

  } catch (e) {
    console.error("Workflow Error", e);
    res.status(500).json({ error: e.message });
  }
});

// Embed API
app.use('/api/embed', embedApi);

// Zapier Auth
// app.use('/api/auth/zapier', zapierAuth); // ZAPIER DISABLED

app.post('/api/agents/chat', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const { agentId, message, sessionId, attachments } = req.body;

  if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });
  if (!agentId || (!message && (!attachments || attachments.length === 0))) return res.status(400).json({ error: 'Missing agentId or content' });

  try {
    const result = await chatWithAgent(userId, orgId, agentId, message || '', sessionId, attachments || [], { novu });
    
    trackEvent('internal_agent_chat', userId, {
        agentId,
        orgId,
        messageLength: message ? message.length : 0
    });

    res.json(result);
  } catch (e) {
    console.error("Agent Chat Error", e);
    res.status(500).json({ error: e.message });
  }
});

// INBOX API (Human Escalation)
app.get('/api/agents/inbox', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const orgId = req.headers['x-organization-id'];
    const { filter } = req.query; // 'all' or default 'escalated'

    if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        let query = supabaseAdmin
            .from('agent_sessions')
            .select(`
                id,
                title,
                status,
                created_at,
                updated_at,
                customer_name,
                customer_email,
                agent:agents!inner(id, name, organization_id),
                last_message:agent_messages(content, created_at, role)
            `)
            .eq('agent.organization_id', orgId) // Ensure org isolation check
            .neq('status', 'closed') // Always hide closed unless specifically requested? User said "open all inbox" -> likely implies active/escalated. Let's exclude closed for now to keep it clean, or maybe include active/escalated.
            .order('updated_at', { ascending: false });

        if (filter !== 'all') {
            query = query.eq('status', 'escalated');
        } else {
             // For "Active" inbox, arguably we might want to see everything NOT closed?
             // Or maybe literally everything.
             // User said "all the chats". I will show everything except closed for now to avoid clutter, 
             // or maybe just show everything. Let's filter out 'closed' only if specific.
             // Actually, user might want to see history. Let's just remove the status filter.
             // But let's verify if 'closed' sessions should be shown. Usually "Inbox" implies open tasks.
             // I'll show 'active' and 'escalated'.
             query = query.in('status', ['active', 'escalated']);
        }
        
        const { data: sessions, error } = await query;

        if (error) throw error;
        
        // Transform for frontend
        const inbox = sessions.map(s => {
            // Pick last user message as preview if possible, or just last message
             const sorted = s.last_message?.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
             const lastMsg = sorted?.[0];
             return {
                 id: s.id,
                 agentName: s.agent.name,
                 title: s.title || lastMsg?.content?.substring(0, 50) || 'New Conversation',
                 status: s.status,
                 lastMessage: lastMsg?.content,
                 updatedAt: s.updated_at,
                 customerName: s.customer_name,
                 customerEmail: s.customer_email
             };
        });

        res.json({ sessions: inbox });
    } catch (e) {
        console.error("Inbox Fetch Error", e);
        res.status(500).json({ error: e.message });
    }
});

// Human Reply Endpoint
app.post('/api/agents/reply', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { sessionId, message } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        // Save human reply as 'assistant'
        const { error } = await supabaseAdmin.from('agent_messages').insert({
            session_id: sessionId,
            role: 'assistant',
            content: message,
            metadata: { responded_by: userId } // Track which human replied
        });

        if (error) throw error;

        // Optionally update updated_at of session
        await supabaseAdmin.from('agent_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);

        res.json({ success: true });
    } catch (e) {
        console.error("Agent Reply Error", e);
        res.status(500).json({ error: e.message });
    }
});

// --- Widget Settings & Uploads ---

app.post('/api/agents/:id/widget-settings', async (req, res) => {
    const { id } = req.params;
    const { settings } = req.body;

    try {
        const { error } = await supabaseAdmin
            .from('agents')
            .update({ widget_settings: settings })
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        console.error("Save Widget Settings Error", e);
        res.status(500).json({ error: e.message });
    }
});

// --- Proactive Triggers CRUD ---

// List triggers for an agent
app.get('/api/agents/:id/triggers', async (req, res) => {
    const { id } = req.params;
    
    try {
        const { data, error } = await supabaseAdmin
            .from('agent_proactive_triggers')
            .select('*')
            .eq('agent_id', id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json({ triggers: data || [] });
    } catch (e) {
        console.error("Get Triggers Error", e);
        res.status(500).json({ error: e.message });
    }
});

// Create a new trigger
app.post('/api/agents/:id/triggers', async (req, res) => {
    const { id } = req.params;
    const { url_pattern, message, delay_seconds, is_enabled } = req.body || {};

    if (!url_pattern || !message) {
        return res.status(400).json({ error: 'url_pattern and message are required' });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('agent_proactive_triggers')
            .insert({
                agent_id: id,
                url_pattern,
                message,
                delay_seconds: delay_seconds ?? 5,
                is_enabled: is_enabled ?? true
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ trigger: data });
    } catch (e) {
        console.error("Create Trigger Error", e);
        res.status(500).json({ error: e.message });
    }
});

// Update a trigger
app.put('/api/agents/:id/triggers/:triggerId', async (req, res) => {
    const { id, triggerId } = req.params;
    const { url_pattern, message, delay_seconds, is_enabled } = req.body || {};

    const updatePayload = { updated_at: new Date().toISOString() };
    if (url_pattern !== undefined) updatePayload.url_pattern = url_pattern;
    if (message !== undefined) updatePayload.message = message;
    if (delay_seconds !== undefined) updatePayload.delay_seconds = delay_seconds;
    if (is_enabled !== undefined) updatePayload.is_enabled = is_enabled;

    try {
        const { data, error } = await supabaseAdmin
            .from('agent_proactive_triggers')
            .update(updatePayload)
            .eq('id', triggerId)
            .eq('agent_id', id)
            .select()
            .single();

        if (error) throw error;
        res.json({ trigger: data });
    } catch (e) {
        console.error("Update Trigger Error", e);
        res.status(500).json({ error: e.message });
    }
});

// Delete a trigger
app.delete('/api/agents/:id/triggers/:triggerId', async (req, res) => {
    const { id, triggerId } = req.params;

    try {
        const { error } = await supabaseAdmin
            .from('agent_proactive_triggers')
            .delete()
            .eq('id', triggerId)
            .eq('agent_id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        console.error("Delete Trigger Error", e);
        res.status(500).json({ error: e.message });
    }
});

// --- Agent Analytics ---

app.get('/api/agents/:id/analytics', async (req, res) => {
    const { id } = req.params;

    try {
        // Total Conversations
        const { count: totalConversations, error: sessErr } = await supabaseAdmin
            .from('agent_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', id);

        if (sessErr) throw sessErr;

        // Get session IDs for this agent
        const { data: sessionData } = await supabaseAdmin
            .from('agent_sessions')
            .select('id')
            .eq('agent_id', id);
        
        const sessionIds = sessionData?.map(s => s.id) || [];

        // Total Messages (only if there are sessions)
        let totalMessages = 0;
        if (sessionIds.length > 0) {
            const { count, error: msgErr } = await supabaseAdmin
                .from('agent_messages')
                .select('id', { count: 'exact', head: true })
                .in('session_id', sessionIds);
            if (!msgErr) totalMessages = count || 0;
        }

        // Escalation Rate
        const { count: escalatedCount } = await supabaseAdmin
            .from('agent_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', id)
            .eq('status', 'escalated');

        // Recent Conversations (last 5)
        const { data: recentSessions } = await supabaseAdmin
            .from('agent_sessions')
            .select('id, title, customer_email, status, created_at')
            .eq('agent_id', id)
            .order('created_at', { ascending: false })
            .limit(5);

        const avgMessagesPerSession = totalConversations && totalConversations > 0 
            ? Math.round(totalMessages / totalConversations * 10) / 10 
            : 0;
        
        const escalationRate = totalConversations && totalConversations > 0
            ? Math.round((escalatedCount || 0) / totalConversations * 100)
            : 0;

        res.json({
            totalConversations: totalConversations || 0,
            totalMessages,
            avgMessagesPerSession,
            escalationRate,
            recentSessions: recentSessions || []
        });
    } catch (e) {
        console.error("Agent Analytics Error", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/embed/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { error } = await supabaseAdmin.storage
            .from('chat-attachments')
            .upload(filePath, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (error) throw error;

        const { data: publicUrlData } = supabaseAdmin.storage
            .from('chat-attachments')
            .getPublicUrl(filePath);

        res.json({ url: publicUrlData.publicUrl, type: req.file.mimetype });
    } catch (e) {
        console.error("Upload Error", e);
        res.status(500).json({ error: e.message });
    }
});

// --- Agent Status & Handoff ---

// Toggle Agent Status (Start/Stop)
app.post('/api/agents/status', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { sessionId, status } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!['active', 'escalated'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    try {
        const { error } = await supabaseAdmin
            .from('agent_sessions')
            .update({ status })
            .eq('id', sessionId);

        if (error) throw error;

        // Trigger notification on manual escalation
        if (status === 'escalated' && novu) {
            try {
                // Get session details for notification
                const { data: sess } = await supabaseAdmin.from('agent_sessions').select('agent_id, agent:agents(organization_id, name)').eq('id', sessionId).single();
                if(sess) {
                     const { data: org } = await supabaseAdmin.from('organizations').select('created_by').eq('id', sess.agent.organization_id).single();
                     const targetUserId = org?.created_by;
                     if(targetUserId) {
                        await novu.trigger('agent-escalation', {
                            to: { subscriberId: targetUserId },
                            payload: {
                                sessionId: sessionId,
                                agentId: sess.agent_id,
                                agentName: sess.agent?.name || 'Agent',
                                message: 'Manual escalation requested'
                            }
                        });
                     }
                }
            } catch(e) { console.error("Novu manual trigger failed", e); }
        }

        res.json({ success: true });
    } catch (e) {
        console.error("Agent Status Update Error", e);
        res.status(500).json({ error: e.message });
    }
});

function buildPrompt(tool, inputs, outputCount, tone) {
  switch (tool) {
    case 'email_subject':
      return `Generate ${outputCount} email subject lines for: ${inputs.topic}\nTarget audience: ${inputs.audience}\nGoal: Maximize ${inputs.goal}${tone ? `\nTone: ${tone}` : ''}\n\nFor each subject line, provide strictly these fields:\n- text\n- openRate (percent string like \'45%\')\n- trigger (e.g., Curiosity)\n- charCount (integer)\n\nReturn as a JSON array.`;
    case 'resume':
      return `Generate ${Math.max(1, outputCount)} powerful resume bullet points based on:\nJob Title: ${inputs.jobTitle}\nAchievements: ${inputs.achievements}\nMetrics: ${inputs.metrics || 'N/A'}${tone ? `\nTone: ${tone}` : ''}\n\nReturn a JSON array of objects with fields:\n- text (the bullet text)\n- actionVerb (the leading action verb)\n- score (ATS fit score like '92/100').`;
    case 'cold_email':
      return `Generate 3 personalized cold email variations for:\nProspect: ${inputs.prospectName}\nCompany: ${inputs.company}\nValue Proposition: ${inputs.valueProp || 'N/A'}\nPain Point: ${inputs.painPoint || 'N/A'}${tone ? `\nTone: ${tone}` : ''}\n\nProvide variations with hooks: Curiosity, Pain-Point, Value-First.\n\nFor each variation, return strictly these fields:\n- text\n- hook (Curiosity Hook | Pain-Point Hook | Value-First Hook)\n- tips (array of 3 short personalization tips)\n- followUps (array of 2 short follow-up templates)\n\nReturn a JSON array.`;
    case 'product_description':
      return `Generate 3 product descriptions for:\nProduct: ${inputs.productName}\nFeatures: ${inputs.features}\nTarget Market: ${inputs.targetMarket}\nPrice Point: ${inputs.pricePoint}${tone ? `\nTone Preference: ${tone}` : ''}\nBullet Mode: ${inputs.bulletMode ? 'ON' : 'OFF'}\n\nReturn a JSON array of objects with fields:\n- text\n- tone (Casual & Friendly | Professional | Luxury Premium)\n- seoKeywords (array of ~5 SEO keywords)\n- metaDescription (concise 140-160 chars)\n- cta (short call-to-action)\n${inputs.bulletMode ? '- bullets (array of 5 concise bullet points for e-commerce listing)\n' : ''}`;
    case 'job_description':
      return `Generate a complete job description for:\nRole Title: ${inputs.roleTitle}\nResponsibilities: ${inputs.responsibilities}\nCulture: ${inputs.culture || 'N/A'}\nExperience Level: ${inputs.experienceLevel}${tone ? `\nTone: ${tone}` : ''}\n\nReturn a single JSON object with strictly these fields:\n- roleSummary (string)\n- responsibilities (array of 5-8 bullet strings)\n- requiredQualifications (array of bullet strings)\n- niceToHave (array of bullet strings)\n- salaryRange (string)\n- culture (string)\n- eeoStatement (string)\n- complianceNotes (array of 3 short notes about inclusive/ADA/EEOC-friendly language)`;
    case 'linkedin':
      return `Generate 3 LinkedIn post variations for:\nTopic: ${inputs.topic}\nIndustry: ${inputs.industry}\nTone: ${inputs.tone}${tone ? `\nTone Override: ${tone}` : ''}\n\nEach variation should include a strong hook, body, and CTA, and suggest hashtags.\nReturn a JSON array of objects with fields:\n- text\n- engagementScore (e.g., 'High', 'Very High', 'Medium-High')\n- hashtags (e.g., '#CareerAdvice #Tech')\n- emojiSuggestions (array of 3-6 relevant emojis).`;
    case 'social_ad':
      return `Generate ${Math.max(1, outputCount)} short social media ad copies for:\nProduct/Service: ${inputs.productName}\nTarget Audience: ${inputs.audience}\nPlatform: ${inputs.platform}\nCampaign Goal: ${inputs.goal}${tone ? `\nTone: ${tone}` : ''}\n\nReturn a JSON array of objects with fields:\n- text\n- platform\n- predictedCtr (percent string like '3.2%')\n- trigger (FOMO | Social Proof | Curiosity | Urgency)\n- charCount (integer)`;
    case 'summarizer':
      return `Condense the following text preserving key points.\nTone: ${inputs.tone}\nTarget length: ${inputs.length}\n\nText:\n${inputs.text}\n\nReturn a single JSON object with fields:\n- summary (string)\n- readability (e.g., '75/100' or 'Grade 8')\n- keyPoints (array of 3-6 short bullets)\n- keywords (array of ~5 SEO keywords)\n- readingTime (string like '35 sec')\n- timeSaved (string like '1m 25s saved')`;
    case 'cover_letter':
      return `Write a professional cover letter (250-300 words).\nJob Title: ${inputs.jobTitle}\nCompany: ${inputs.company}\nKey Achievement: ${inputs.achievement}\nHiring Manager: ${inputs.hiringManager || 'N/A'}${tone ? `\nTone: ${tone}` : ''}\n\nReturn a single JSON object with fields:\n- text\n- atsScore (like '92/100')\n- openingHook (string)\n- closing (string)`;
    case 'twitter_thread':
      return `Compose a Twitter/X thread.\nTopic: ${inputs.topic}\nAudience: ${inputs.audience}\nTone: ${inputs.tone}\nLength: ${inputs.length} tweets\n\nReturn a single JSON object with fields:\n- tweets (array of ${inputs.length || 5} strings, numbered appropriately)\n- engagementPrediction (string like 'Est. 450 likes, 120 reposts')\n- hashtags (string like '#growth #startups')`;
    case 'faq':
      return `Generate an FAQ section.\nProduct/Service: ${inputs.productName}\nPain Points: ${inputs.painPoints}\nFeatures: ${inputs.features}\nFAQ Count: ${inputs.count || 10}${tone ? `\nTone: ${tone}` : ''}\n\nReturn a single JSON object with fields:\n- items (array of objects with {question, answer})\n- seoScore (like '8.5/10')\n- schemaMarkup (JSON-LD string for FAQPage)`;
    case 'script':
      return `Write a script/voiceover.\nTopic: ${inputs.topic}\nDuration: ${inputs.duration}\nTone: ${inputs.tone}\nTarget Viewer: ${inputs.viewer}\n\nInclude pacing and clear [Action]/[Pause] markers with timestamps.\nReturn a single JSON object with fields:\n- segments (array of objects with {time, line})\n- pacingWpm (number)\n- wordCount (number)\n- readTime (string)`;
    case 'blog_helper':
      return `You are an expert blog and article writing assistant.\nMode: ${inputs.mode} (one of: intro, outline, conclusion, section, paragraph, paragraph_expand, sentence_expand, article_expand, article_rewrite).\nTopic: ${inputs.topic}\nTarget audience: ${inputs.audience || 'general readers'}\nKeywords: ${inputs.keywords || 'none'}\nTone: ${inputs.tone || tone || 'neutral'}\nSource text (if provided for expand/rewrite modes): ${inputs.sourceText || 'N/A'}\n\nGenerate ${outputCount} variants appropriate for the selected mode.\nReturn a JSON array of objects with the following field:\n- text (the generated content as a string)`;
    case 'copy_helper':
      return `You are an expert direct-response copywriter.\nMode: ${inputs.mode} (one of: aida, pas, pbs, sales_blurb, tagline).\nProduct or offer: ${inputs.product}\nAudience: ${inputs.audience || 'general audience'}\nOffer or main benefit: ${inputs.offer || 'N/A'}\nPain points to address: ${inputs.painPoints || 'N/A'}\nTone: ${inputs.tone || tone || 'neutral'}\n\nGenerate ${Math.max(1, outputCount)} short copy variations tailored to this mode.\nReturn a JSON array of objects with:\n- text (the copy as a single string)`;
    case 'social_helper':
      return `You are a social media copywriter.\nMode: ${inputs.mode} (one of: post, caption, hook, hashtag_block, bio).\nPlatform: ${inputs.platform}\nTopic: ${inputs.topic}\nAudience: ${inputs.audience || 'general followers'}\nCTA or goal: ${inputs.cta || 'N/A'}\nTone: ${inputs.tone || tone || 'neutral'}\n\nGenerate ${Math.max(1, outputCount)} variations suitable for this platform and mode.\n\nFormatting rules (important):\n- Use plain text only.\n- Do not use markdown syntax (no *, **, bullet markers, or code fences).\n- Do not use emojis or emoji characters.\n- You may use normal sentences and line breaks.\n\nReturn a JSON array of objects with:\n- text (the post, caption, hook, hashtag block, or bio as a single string)`;
    case 'email_writer':
      return `You are a helpful professional email writer.\nEmail type: ${inputs.emailType} (one of: follow_up, outreach, newsletter, professional, thank_you).\nRecipient: ${inputs.recipient || 'N/A'}\nSubject or topic: ${inputs.subject || inputs.topic || 'N/A'}\nContext / key details: ${inputs.context || 'N/A'}\nTone: ${inputs.tone || tone || 'professional'}\n\nWrite ${Math.max(1, outputCount)} concise email drafts (body only; you may include a clear subject line at the top if helpful).\nReturn a JSON array of objects with:\n- text (the full email content as a single string)`;
    case 'rewrite_helper':
      return `You are an expert editor and rewriting assistant.\nMode: ${inputs.mode} (one of: rewrite, improve, simplify, formal, casual, shorten, expand, tone_change).\nTone: ${inputs.tone || tone || 'neutral'}\nTarget length: ${inputs.length || 'same'}\nExtra instructions: ${inputs.instructions || 'N/A'}\n\nOriginal text:\n${inputs.sourceText}\n\nRewrite the text according to the mode and instructions, generating ${Math.max(1, outputCount)} distinct variations.\nReturn a JSON array of objects with:\n- text (the rewritten text as a single string)`;
    case 'blog_post': {
      const isLong = inputs.length === 'long';
      const role = isLong
        ? 'You are an expert long-form blog writer. You write comprehensive, deep-dive articles.'
        : 'You are a professional blog writer.';

      const taskInstruction = isLong
        ? 'Write a complete, extensive blog article. Add detailed explanations, multiple examples, case studies, and practical applications in every section. The total word count must comfortably exceed 3000 words.'
        : 'Write a standard blog post. Aim for around 1500 words with clear headings.';

      return `${role}\nTopic: ${
        inputs.topic
      }\nTarget audience: ${
        inputs.audience || 'general readers'
      }\nGoal: ${
        inputs.goal || 'educate and engage'
      }\nPrimary keyword: ${
        inputs.primaryKeyword || 'N/A'
      }\nSecondary keywords: ${
        inputs.secondaryKeywords || 'N/A'
      }\nOutline mode: ${
        inputs.outlineMode || 'auto'
      } (auto | custom)\nCustom outline (if any):\n${
        inputs.customOutline || 'N/A'
      }\nTarget length: ${inputs.length}\nTone: ${
        inputs.tone || tone || 'neutral'
      }\n\n${taskInstruction}\n\nFormatting rules (important):\n- Use plain text only.\n- Do not use markdown syntax (no *, **, bullet markers, or code fences).\n- Do not include markdown headings like #, ##, or code fences.\n- You may still use numbered lists like '1.' or '2.' when helpful.\n\nReturn a single JSON object with fields:\n- title\n- slug_suggestion\n- outline (array of heading strings)\n- body (full text as a single string)\n- meta_description`;
    }
    case 'article_from_outline': {
      const isArtLong = inputs.length === 'long';

      const artRole = isArtLong
        ? 'You are an expert long-form article writer. Expand the outline into a comprehensive deep-dive.'
        : 'You are an expert article writer.';

      const articleTaskInstruction = isArtLong
        ? 'Expand each outline point into multiple rich paragraphs with examples, data, and detailed explanations. The total word count must comfortably exceed 3000 words.'
        : 'Write a balanced article. The total word count should be around 1500 words.';

      return `${artRole} Expand the provided outline.\nTitle or topic: ${
        inputs.topic
      }\nOutline:\n${
        inputs.outline
      }\nTarget audience: ${
        inputs.audience || 'general readers'
      }\nTarget length: ${inputs.length}\nTone: ${
        inputs.tone || tone || 'neutral'
      }\n\n${articleTaskInstruction}\n\nFormatting rules (important):\n- Use plain text only.\n- Do not use markdown syntax (no *, **, bullet markers, or code fences).\n- Do not include markdown headings like #, ##, or code fences.\n- You may still use numbered lists like '1.' or '2.' when helpful.\n\nReturn a single JSON object with fields:\n- title\n- outline (normalized array of headings)\n- body (full text as a single string)`;
    }
    case 'seo_blog_optimizer': {
      return `You are an SEO expert and editor. Improve the following blog article for SEO and readability.\nPrimary keyword: ${
        inputs.primaryKeyword
      }\nSecondary keywords: ${
        inputs.secondaryKeywords || 'N/A'
      }\nGoal: ${
        inputs.goal || 'improve organic traffic and CTR'
      }\nTone: ${inputs.tone || tone || 'neutral'}\n\nOriginal article:\n${
        inputs.originalText
      }\n\nFormatting rules (important):\n- Use plain text only.\n- Do not use markdown syntax (no *, **, bullet markers, or code fences).\n- Do not include markdown headings like #, ##, or code fences.\n- You may still use numbered lists like '1.' or '2.' when helpful.\n\nReturn a single JSON object with fields:\n- optimized_title\n- optimized_meta_description\n- optimized_body\n- suggested_headings (array of strings)\n- keyword_usage_notes (array of short bullet strings)\n- improvements_summary (short paragraph)`;
    }
    case 'case_study_writer': {
      return `You are a B2B case study writer. Create a compelling success story.\nClient name: ${
        inputs.clientName || 'N/A'
      }\nIndustry: ${
        inputs.industry || 'N/A'
      }\nProblem / challenge: ${
        inputs.problem
      }\nSolution summary: ${
        inputs.solution
      }\nKey results and metrics: ${
        inputs.results
      }\nTone: ${inputs.tone || tone || 'professional'}\n\nWrite a detailed narrative case study with clear section transitions.\n\nFormatting rules (important):\n- Use plain text only.\n- Do not use markdown syntax (no *, **, bullet markers, or code fences).\n- Do not include markdown headings like #, ##, or code fences.\n- You may still use numbered lists like '1.' or '2.' when listing results.\n\nReturn a single JSON object with fields:\n- headline\n- summary\n- background\n- challenge\n- solution\n- results\n- quote`;
    }
    case 'landing_page_writer': {
      return `You are a conversion-focused landing page copywriter.\nProduct or offer: ${
        inputs.product
      }\nTarget audience: ${inputs.audience}\nMain benefit / promise: ${
        inputs.benefit
      }\nKey features: ${inputs.features}\nOffer and pricing: ${
        inputs.offer || 'N/A'
      }\nTone: ${
        inputs.tone || tone || 'persuasive'
      }\n\nWrite a full landing page including hero, social proof, benefits, and a closing section.\n\nFormatting rules (important):\n- Use plain text only.\n- Do not use markdown syntax (no *, **, bullet markers, or code fences).\n- Do not include markdown headings like #, ##, or code fences.\n- You may still use numbered lists like '1.' or '2.' when helpful.\n\nReturn a single JSON object with fields:\n- hero_headline\n- hero_subheadline\n- hero_cta\n- sections (array of { title, body })\n- faq_items (array of { question, answer })`;
    }
    case 'report_writer': {
      return `You are a professional report/whitepaper writer. Draft a structured long-form report.\nTopic: ${
        inputs.topic
      }\nTarget audience: ${
        inputs.audience || 'executives'
      }\nKey points or thesis: ${
        inputs.keyPoints
      }\nDesired sections: ${
        inputs.sections || 'auto'
      }\nTone: ${
        inputs.tone || tone || 'formal'
      }\nTarget length: ${
        inputs.length || 'long'
      } (short ~1500 words, medium ~2500 words, long ~3000+ words; for long, write at least 2800 words)\n\nWrite a detailed report with multiple well-developed sections.\n\nFormatting rules (important):\n- Use plain text only.\n- Do not use markdown syntax (no *, **, bullet markers, or code fences).\n- Do not include markdown headings like #, ##, or code fences.\n- You may still use numbered lists like '1.' or '2.' when helpful.\n\nReturn a single JSON object with fields:\n- title\n- abstract\n- sections (array of { heading, body })`;
    }
    default:
      return `Inputs: ${JSON.stringify(inputs)}. Return concise JSON.`;
  }
}

function stripBasicMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1');
}

function formatResults(tool, data) {
  switch (tool) {
    case 'email_subject': {
      const arr = Array.isArray(data) ? data : [];
      return arr.map((item) => ({
        text: String(item?.text ?? ''),
        openRate: String(item?.openRate ?? ''),
        trigger: String(item?.trigger ?? ''),
        charCount: Number(item?.charCount ?? 0),
      }));
    }
    case 'resume': {
      const arr = Array.isArray(data) ? data : [];
      return arr.map((item) => ({
        text: String(item?.text ?? ''),
        actionVerb: String(item?.actionVerb ?? ''),
        score: String(item?.score ?? ''),
      }));
    }
    case 'cold_email': {
      const arr = Array.isArray(data) ? data : [];
      return arr.map((item) => ({
        text: String(item?.text ?? ''),
        hook: String(item?.hook ?? ''),
        tips: Array.isArray(item?.tips) ? item.tips.map((t) => String(t)) : [],
        followUps: Array.isArray(item?.followUps) ? item.followUps.map((t) => String(t)) : [],
      }));
    }
    case 'product_description': {
      const arr = Array.isArray(data) ? data : [];
      return arr.map((item) => ({
        text: String(item?.text ?? ''),
        tone: String(item?.tone ?? ''),
        seoKeywords: Array.isArray(item?.seoKeywords) ? item.seoKeywords.map((t) => String(t)) : [],
        metaDescription: String(item?.metaDescription ?? ''),
        cta: String(item?.cta ?? ''),
        bullets: Array.isArray(item?.bullets) ? item.bullets.map((t) => String(t)) : [],
      }));
    }
    case 'job_description': {
      if (data && typeof data === 'object') {
        return {
          roleSummary: String(data?.roleSummary ?? ''),
          responsibilities: Array.isArray(data?.responsibilities) ? data.responsibilities.map((t) => String(t)) : [],
          requiredQualifications: Array.isArray(data?.requiredQualifications) ? data.requiredQualifications.map((t) => String(t)) : [],
          niceToHave: Array.isArray(data?.niceToHave) ? data.niceToHave.map((t) => String(t)) : [],
          salaryRange: String(data?.salaryRange ?? ''),
          culture: String(data?.culture ?? ''),
          eeoStatement: String(data?.eeoStatement ?? ''),
          complianceNotes: Array.isArray(data?.complianceNotes) ? data.complianceNotes.map((t) => String(t)) : [],
        };
      }
      return {
        roleSummary: String(data ?? ''),
        responsibilities: [],
        requiredQualifications: [],
        niceToHave: [],
        salaryRange: '',
        culture: '',
        eeoStatement: '',
        complianceNotes: [],
      };
    }
    case 'linkedin': {
      const arr = Array.isArray(data) ? data : [];
      return arr.map((item) => ({
        text: String(item?.text ?? ''),
        engagementScore: String(item?.engagementScore ?? ''),
        hashtags: String(item?.hashtags ?? ''),
        emojiSuggestions: Array.isArray(item?.emojiSuggestions) ? item.emojiSuggestions.map((t) => String(t)) : [],
      }));
    }
    case 'social_ad': {
      const arr = Array.isArray(data) ? data : [];
      return arr.map((item) => ({
        text: String(item?.text ?? ''),
        platform: String(item?.platform ?? ''),
        predictedCtr: String(item?.predictedCtr ?? ''),
        trigger: String(item?.trigger ?? ''),
        charCount: Number(item?.charCount ?? 0),
      }));
    }
    case 'summarizer': {
      if (data && typeof data === 'object') {
        return {
          summary: String(data?.summary ?? ''),
          readability: String(data?.readability ?? ''),
          keyPoints: Array.isArray(data?.keyPoints) ? data.keyPoints.map((t) => String(t)) : [],
          keywords: Array.isArray(data?.keywords) ? data.keywords.map((t) => String(t)) : [],
          readingTime: String(data?.readingTime ?? ''),
          timeSaved: String(data?.timeSaved ?? ''),
        };
      }
      return {
        summary: String(data ?? ''),
        readability: '',
        keyPoints: [],
        keywords: [],
        readingTime: '',
        timeSaved: '',
      };
    }
    case 'cover_letter': {
      if (data && typeof data === 'object') {
        return {
          text: String(data?.text ?? ''),
          atsScore: String(data?.atsScore ?? ''),
          openingHook: String(data?.openingHook ?? ''),
          closing: String(data?.closing ?? ''),
        };
      }
      return { text: String(data ?? ''), atsScore: '', openingHook: '', closing: '' };
    }
    case 'twitter_thread': {
      if (data && typeof data === 'object') {
        return {
          tweets: Array.isArray(data?.tweets) ? data.tweets.map((t) => String(t)) : [],
          engagementPrediction: String(data?.engagementPrediction ?? ''),
          hashtags: String(data?.hashtags ?? ''),
        };
      }
      return { tweets: [], engagementPrediction: '', hashtags: '' };
    }
    case 'faq': {
      if (data && typeof data === 'object') {
        return {
          items: Array.isArray(data?.items)
            ? data.items.map((it) => ({
                question: String(it?.question ?? ''),
                answer: String(it?.answer ?? ''),
              }))
            : [],
          seoScore: String(data?.seoScore ?? ''),
          schemaMarkup: String(data?.schemaMarkup ?? ''),
        };
      }
      return { items: [], seoScore: '', schemaMarkup: '' };
    }
    case 'script': {
      if (data && typeof data === 'object') {
        return {
          segments: Array.isArray(data?.segments)
            ? data.segments.map((s) => ({
                time: String(s?.time ?? ''),
                line: String(s?.line ?? ''),
              }))
            : [],
          pacingWpm: Number(data?.pacingWpm ?? 0),
          wordCount: Number(data?.wordCount ?? 0),
          readTime: String(data?.readTime ?? ''),
        };
      }
      return { segments: [], pacingWpm: 0, wordCount: 0, readTime: '' };
    }
    case 'blog_post': {
      const item = Array.isArray(data) ? data[0] : data;
      if (item && typeof item === 'object') {
        return {
          title: stripBasicMarkdown(String(item?.title ?? '')),
          slug_suggestion: stripBasicMarkdown(String(item?.slug_suggestion ?? '')),
          outline: Array.isArray(item?.outline)
            ? item.outline.map((t) => stripBasicMarkdown(String(t ?? '')))
            : [],
          body: stripBasicMarkdown(String(item?.body ?? '')),
          meta_description: stripBasicMarkdown(String(item?.meta_description ?? '')),
        };
      }
      return {
        title: '',
        slug_suggestion: '',
        outline: [],
        body: stripBasicMarkdown(String(item ?? data ?? '')),
        meta_description: '',
      };
    }
    case 'article_from_outline': {
      const item = Array.isArray(data) ? data[0] : data;
      if (item && typeof item === 'object') {
        return {
          title: stripBasicMarkdown(String(item?.title ?? '')),
          outline: Array.isArray(item?.outline)
            ? item.outline.map((t) => stripBasicMarkdown(String(t ?? '')))
            : [],
          body: stripBasicMarkdown(String(item?.body ?? '')),
        };
      }
      return {
        title: '',
        outline: [],
        body: stripBasicMarkdown(String(item ?? data ?? '')),
      };
    }
    case 'seo_blog_optimizer': {
      const item = Array.isArray(data) ? data[0] : data;
      if (item && typeof item === 'object') {
        return {
          optimized_title: stripBasicMarkdown(String(item?.optimized_title ?? '')),
          optimized_meta_description: stripBasicMarkdown(String(item?.optimized_meta_description ?? '')),
          optimized_body: stripBasicMarkdown(String(item?.optimized_body ?? '')),
          suggested_headings: Array.isArray(item?.suggested_headings)
            ? item.suggested_headings.map((t) => stripBasicMarkdown(String(t ?? '')))
            : [],
          keyword_usage_notes: Array.isArray(item?.keyword_usage_notes)
            ? item.keyword_usage_notes.map((t) => stripBasicMarkdown(String(t ?? '')))
            : [],
          improvements_summary: stripBasicMarkdown(String(item?.improvements_summary ?? '')),
        };
      }
      return {
        optimized_title: '',
        optimized_meta_description: '',
        optimized_body: stripBasicMarkdown(String(item ?? data ?? '')),
        suggested_headings: [],
        keyword_usage_notes: [],
        improvements_summary: '',
      };
    }
    case 'case_study_writer': {
      const item = Array.isArray(data) ? data[0] : data;
      if (item && typeof item === 'object') {
        return {
          headline: stripBasicMarkdown(String(item?.headline ?? '')),
          summary: stripBasicMarkdown(String(item?.summary ?? '')),
          background: stripBasicMarkdown(String(item?.background ?? '')),
          challenge: stripBasicMarkdown(String(item?.challenge ?? '')),
          solution: stripBasicMarkdown(String(item?.solution ?? '')),
          results: stripBasicMarkdown(String(item?.results ?? '')),
          quote: stripBasicMarkdown(String(item?.quote ?? '')),
        };
      }
      return {
        headline: '',
        summary: '',
        background: '',
        challenge: '',
        solution: '',
        results: stripBasicMarkdown(String(item ?? data ?? '')),
        quote: '',
      };
    }
    case 'landing_page_writer': {
      const item = Array.isArray(data) ? data[0] : data;
      if (item && typeof item === 'object') {
        return {
          hero_headline: stripBasicMarkdown(String(item?.hero_headline ?? '')),
          hero_subheadline: stripBasicMarkdown(String(item?.hero_subheadline ?? '')),
          hero_cta: stripBasicMarkdown(String(item?.hero_cta ?? '')),
          sections: Array.isArray(item?.sections)
            ? item.sections.map((s) => ({
                title: stripBasicMarkdown(String(s?.title ?? '')),
                body: stripBasicMarkdown(String(s?.body ?? '')),
              }))
            : [],
          faq_items: Array.isArray(item?.faq_items)
            ? item.faq_items.map((f) => ({
                question: stripBasicMarkdown(String(f?.question ?? '')),
                answer: stripBasicMarkdown(String(f?.answer ?? '')),
              }))
            : [],
        };
      }
      return {
        hero_headline: '',
        hero_subheadline: '',
        hero_cta: '',
        sections: [],
        faq_items: [],
      };
    }
    case 'report_writer': {
      const item = Array.isArray(data) ? data[0] : data;
      if (item && typeof item === 'object') {
        return {
          title: stripBasicMarkdown(String(item?.title ?? '')),
          abstract: stripBasicMarkdown(String(item?.abstract ?? '')),
          sections: Array.isArray(item?.sections)
            ? item.sections.map((s) => ({
                heading: stripBasicMarkdown(String(s?.heading ?? '')),
                body: stripBasicMarkdown(String(s?.body ?? '')),
              }))
            : [],
        };
      }
      return {
        title: '',
        abstract: '',
        sections: [],
      };
    }
    case 'blog_helper': {
      const arr = Array.isArray(data) ? data : data ? [data] : [];
      return arr.map((item) => {
        let text = '';

        if (item && typeof item === 'object') {
          if (typeof item.text === 'string' && item.text.trim()) {
            const raw = item.text.trim();

            if ((raw.startsWith('{') || raw.startsWith('[')) && raw.includes('"outline"')) {
              try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed?.outline)) {
                  text = parsed.outline.map((line) => String(line ?? '')).join('\n');
                } else {
                  text = raw;
                }
              } catch {
                text = raw;
              }
            } else {
              text = raw;
            }
          } else if (Array.isArray(item.outline)) {
            text = item.outline.map((line) => String(line ?? '')).join('\n');
          } else if (typeof item.outline === 'string') {
            text = String(item.outline);
          } else if (typeof item.content === 'string') {
            text = String(item.content);
          } else {
            try {
              text = JSON.stringify(item, null, 2);
            } catch {
              text = String(item ?? '');
            }
          }
        } else if (typeof item === 'string') {
          text = item;
        } else {
          text = String(item ?? '');
        }

        return { text };
      });
    }
    case 'copy_helper': {
      const arr = Array.isArray(data) ? data : data ? [data] : [];
      return arr.map((item) => {
        if (typeof item === 'string') return { text: item };
        let text = '';
        if (item && typeof item === 'object' && typeof item.text === 'string') {
          text = item.text;
        } else {
          try {
            text = JSON.stringify(item, null, 2);
          } catch {
            text = String(item ?? '');
          }
        }
        return { text };
      });
    }
    case 'social_helper': {
      const cleanText = (value) => {
        if (!value) return '';
        let cleaned = String(value).replace(/\*/g, '');
        cleaned = cleaned.replace(
          /[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{2600}-\u{27BF}]/gu,
          '',
        );
        cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
        return cleaned;
      };
      const arr = Array.isArray(data) ? data : data ? [data] : [];
      return arr.map((item) => {
        let base = '';
        if (typeof item === 'string') {
          base = item;
        } else if (item && typeof item === 'object' && typeof item.text === 'string') {
          base = item.text;
        } else {
          try {
            base = JSON.stringify(item, null, 2);
          } catch {
            base = String(item ?? '');
          }
        }
        return { text: cleanText(base) };
      });
    }
    case 'email_writer': {
      const arr = Array.isArray(data) ? data : data ? [data] : [];
      return arr.map((item) => {
        if (typeof item === 'string') return { text: item };
        let text = '';
        if (item && typeof item === 'object' && typeof item.text === 'string') {
          text = item.text;
        } else {
          try {
            text = JSON.stringify(item, null, 2);
          } catch {
            text = String(item ?? '');
          }
        }
        return { text };
      });
    }
    case 'rewrite_helper': {
      const arr = Array.isArray(data) ? data : data ? [data] : [];
      return arr.map((item) => {
        if (typeof item === 'string') return { text: item };
        let text = '';
        if (item && typeof item === 'object' && typeof item.text === 'string') {
          text = item.text;
        } else {
          try {
            text = JSON.stringify(item, null, 2);
          } catch {
            text = String(item ?? '');
          }
        }
        return { text };
      });
    }
    default:
      return data;
  }
}
// Saved results endpoints
app.get('/api/results', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  }
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  try {
    const { data, error } = await supabaseAdmin
      .from('saved_results')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ results: data });
  } catch (err) {
    console.error('[Results][GET] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
});

app.post('/api/results/save', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  }
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  const parsed = SaveResultsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_REQUEST', details: parsed.error.flatten() });
  }
  try {
    const payload = { ...parsed.data, user_id: userId, organization_id: orgId || null };
    const { data, error } = await supabaseAdmin
      .from('saved_results')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ saved: data });
  } catch (err) {
    console.error('[Results][SAVE] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
});

app.delete('/api/results/:id', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  }
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  const id = req.params.id;
  try {
    const { error } = await supabaseAdmin
      .from('saved_results')
      .delete()
      .match({ id, user_id: userId });
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[Results][DELETE] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
});

// Profile endpoint for dashboard
app.get('/api/profile', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  }
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  try {
    let data = null;
    try {
      const res1 = await supabaseAdmin
        .from('users')
        .select('monthly_token_limit, tokens_used_this_month, credits_balance, credits_lifetime, email, subscription_tier')
        .eq('id', userId)
        .single();
      if (res1.error) throw res1.error;
      data = res1.data;
    } catch (e) {
      // Fallback if credits columns don't exist yet
      const res2 = await supabaseAdmin
        .from('users')
        .select('monthly_token_limit, tokens_used_this_month, email, subscription_tier')
        .eq('id', userId)
        .single();
      if (res2.error) throw res2.error;
      data = {
        ...res2.data,
        credits_balance: null,
        credits_lifetime: null,
      };
    }
    res.json({
      monthly_token_limit: data?.monthly_token_limit ?? 0,
      tokens_used_this_month: data?.tokens_used_this_month ?? 0,
      credits_balance: data?.credits_balance ?? null,
      credits_lifetime: data?.credits_lifetime ?? null,
      email: data?.email ?? null,
      subscription_tier: data?.subscription_tier ?? null,
    });
  } catch (err) {
    console.error('[Profile] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
});

app.post('/api/checkout/session', async (req, res) => {
  console.log('[Checkout][SESSION] Incoming request');
  if (!stripe) {
    console.error('[Checkout][SESSION] STRIPE_SECRET_KEY not configured');
    return res.status(500).json({ error: 'STRIPE_NOT_CONFIGURED', message: 'Stripe is not configured' });
  }
  if (!supabaseAdmin) {
    console.error('[Checkout][SESSION] Supabase admin not configured');
    return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  }
  const userId = req.headers['x-user-id'];
  if (!userId) {
    console.warn('[Checkout][SESSION] Missing X-User-Id header');
    return res.status(401).json({ error: 'NO_USER_ID' });
  }

  const amountUsd = Number(req.body?.amountUsd || 0);
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    console.warn('[Checkout][SESSION] Invalid amountUsd', { amountUsd });
    return res.status(400).json({ error: 'INVALID_AMOUNT', message: 'amountUsd must be > 0' });
  }

  const amountCents = Math.max(100, Math.round(amountUsd * 100));
  const creditsPerUsd = 1000;
  const creditsToAdd = Math.max(1, Math.round(amountUsd * creditsPerUsd));

  try {
    console.log('[Checkout][SESSION] Creating credits_transactions row', {
      userId,
      amountCents,
      creditsToAdd,
    });
    const { data: tx, error: txError } = await supabaseAdmin
      .from('credits_transactions')
      .insert({
        user_id: userId,
        amount_cents: amountCents,
        credits_added: creditsToAdd,
        status: 'pending',
      })
      .select('*')
      .single();
    if (txError) {
      console.error('[Checkout][SESSION] Failed to insert credits_transactions', txError);
      return res.status(500).json({ error: 'TX_INSERT_FAILED', message: String(txError?.message || txError) });
    }

    const protoHeader = req.headers['x-forwarded-proto'] || 'http';
    const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
    const hostHeader = req.headers.host || `localhost:${PORT}`;
    const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
    const base = `${proto}://${host}`;

    console.log('[Checkout][SESSION] Creating Stripe Checkout Session');
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: { name: `${amountUsd} USD Credits` },
          },
        },
      ],
      metadata: {
        user_id: String(userId),
        credits_tx_id: String(tx.id),
      },
      success_url: `${base}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/dashboard?checkout_canceled=1`,
    });

    try {
      await supabaseAdmin
        .from('credits_transactions')
        .update({ stripe_session_id: session.id })
        .eq('id', tx.id);
      console.log('[Checkout][SESSION] Linked Stripe session to credits_transactions', {
        txId: tx.id,
        stripeSessionId: session.id,
      });
    } catch (linkError) {
      console.warn('[Checkout][SESSION] Failed to update credits_transactions with stripe_session_id', linkError);
    }

    console.log('[Checkout][SESSION] Success, returning session.url');
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('[Checkout][SESSION] Stripe error', e);
    return res.status(500).json({ error: 'STRIPE_ERROR', message: String(e?.message || e) });
  }
});

app.post('/api/checkout/confirm', async (req, res) => {
  console.log('[Checkout][CONFIRM] Incoming request');
  if (!stripe) {
    console.error('[Checkout][CONFIRM] STRIPE_SECRET_KEY not configured');
    return res.status(500).json({ error: 'STRIPE_NOT_CONFIGURED', message: 'Stripe is not configured' });
  }
  if (!supabaseAdmin) {
    console.error('[Checkout][CONFIRM] Supabase admin not configured');
    return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  }
  const userId = req.headers['x-user-id'];
  if (!userId) {
    console.warn('[Checkout][CONFIRM] Missing X-User-Id header');
    return res.status(401).json({ error: 'NO_USER_ID' });
  }

  const sessionId = (req.body && req.body.sessionId) || (req.query && req.query.session_id);
  if (!sessionId) {
    console.warn('[Checkout][CONFIRM] Missing sessionId');
    return res.status(400).json({ error: 'MISSING_SESSION_ID', message: 'sessionId is required' });
  }

  try {
    // Check Stripe status first
    console.log('[Checkout][CONFIRM] Retrieving Stripe session', { sessionId });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === 'paid' || session.status === 'complete';
    
    if (!paid) {
      return res.status(400).json({ error: 'NOT_PAID', message: 'Payment not completed' });
    }

    // Call robust SQL function to fulfill
    const { data, error } = await supabaseAdmin.rpc('fulfill_checkout', { session_id: sessionId });
    
    if (error) {
      console.error('[Checkout][CONFIRM] RPC error', error);
      return res.status(500).json({ error: 'FULFILLMENT_FAILED', message: error.message });
    }

    console.log('[Checkout][CONFIRM] Fulfillment result', data);
    
    if (data && data.error) {
       return res.status(400).json({ error: 'FULFILLMENT_ERROR', message: data.error });
    }

    return res.json({
      ok: true,
      credits_added: data.credits_added,
      new_balance: data.new_balance,
      status: data.status,
    });
  } catch (e) {
    console.error('[Checkout][CONFIRM] Error', e);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(e?.message || e) });
  }
});

// --- STRIPE WEBHOOKS ---
// This endpoint handles Stripe webhook events for payment confirmations
// IMPORTANT: This must use raw body parsing for signature verification
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log('[Webhook][Stripe] Incoming webhook event');
  
  if (!stripe) {
    console.error('[Webhook][Stripe] STRIPE_SECRET_KEY not configured');
    return res.status(500).json({ error: 'STRIPE_NOT_CONFIGURED' });
  }
  if (!supabaseAdmin) {
    console.error('[Webhook][Stripe] Supabase admin not configured');
    return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  // Verify webhook signature if secret is configured
  if (webhookSecret) {
    const sig = req.headers['stripe-signature'];
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('[Webhook][Stripe] Signature verification failed:', err.message);
      return res.status(400).json({ error: 'INVALID_SIGNATURE', message: err.message });
    }
  } else {
    // For development without webhook secret (NOT recommended for production)
    console.warn('[Webhook][Stripe] No STRIPE_WEBHOOK_SECRET configured, skipping signature verification');
    try {
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (err) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD' });
    }
  }

  console.log('[Webhook][Stripe] Event type:', event.type, 'ID:', event.id);

  try {
    switch (event.type) {
      // One-time credit purchase completed
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('[Webhook][Stripe] checkout.session.completed', session.id);
        
        // Only handle one-time payments (not subscriptions which have their own flow)
        if (session.mode === 'payment') {
          const { data, error } = await supabaseAdmin.rpc('fulfill_checkout', { 
            session_id: session.id 
          });
          
          if (error) {
            console.error('[Webhook][Stripe] fulfill_checkout error:', error);
          } else {
            console.log('[Webhook][Stripe] Credits fulfilled:', data);
          }
        }
        break;
      }

      // Subscription invoice paid (monthly/yearly renewal)
      case 'invoice.paid': {
        const invoice = event.data.object;
        console.log('[Webhook][Stripe] invoice.paid', invoice.id, 'subscription:', invoice.subscription);
        
        // Skip if no subscription (one-time invoices)
        if (!invoice.subscription) break;
        
        // Get the subscription to find the org
        const { data: orgSub } = await supabaseAdmin
          .from('organization_subscriptions')
          .select('organization_id, plan_code, trial_credits_granted')
          .eq('stripe_subscription_id', invoice.subscription)
          .maybeSingle();
        
        if (!orgSub) {
          console.warn('[Webhook][Stripe] No org subscription found for:', invoice.subscription);
          break;
        }

        // Get plan details for monthly credits
        const { data: plan } = await supabaseAdmin
          .from('subscription_plans')
          .select('included_credits_per_month')
          .eq('code', orgSub.plan_code)
          .maybeSingle();
        
        if (!plan) {
          console.warn('[Webhook][Stripe] No plan found for code:', orgSub.plan_code);
          break;
        }

        const creditsToAdd = plan.included_credits_per_month || 0;
        
        // Add monthly credits to organization
        const { error: creditError } = await supabaseAdmin
          .from('organization_credits')
          .upsert({
            organization_id: orgSub.organization_id,
            balance_credits: creditsToAdd
          }, {
            onConflict: 'organization_id'
          });

        // If upsert doesn't work well for incrementing, use this approach:
        if (creditError) {
          // Fallback: increment directly
          await supabaseAdmin.rpc('add_monthly_credits', {
            p_organization_id: orgSub.organization_id,
            p_credits: creditsToAdd
          });
        }

        console.log('[Webhook][Stripe] Added', creditsToAdd, 'credits to org', orgSub.organization_id);
        
        // Update subscription period
        await supabaseAdmin
          .from('organization_subscriptions')
          .update({
            status: 'active',
            current_period_start: new Date(invoice.period_start * 1000).toISOString(),
            current_period_end: new Date(invoice.period_end * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', invoice.subscription);
        
        break;
      }

      // Subscription status changed
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log('[Webhook][Stripe] customer.subscription.updated', subscription.id, 'status:', subscription.status);
        
        const { error } = await supabaseAdmin
          .from('organization_subscriptions')
          .update({
            status: subscription.status, // active, past_due, canceled, etc.
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);
        
        if (error) {
          console.error('[Webhook][Stripe] Failed to update subscription status:', error);
        }
        break;
      }

      // Subscription deleted/cancelled
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log('[Webhook][Stripe] customer.subscription.deleted', subscription.id);
        
        await supabaseAdmin
          .from('organization_subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }

      default:
        console.log('[Webhook][Stripe] Unhandled event type:', event.type);
    }

    // Always return 200 to acknowledge receipt
    return res.json({ received: true });
  } catch (err) {
    console.error('[Webhook][Stripe] Processing error:', err);
    // Still return 200 to prevent Stripe from retrying
    return res.json({ received: true, error: err.message });
  }
});


app.post('/api/billing/subscription/session', async (req, res) => {
  console.log('[Billing][SUBSCRIPTION_SESSION] Incoming request');
  if (!stripe) {
    console.error('[Billing][SUBSCRIPTION_SESSION] STRIPE_SECRET_KEY not configured');

    return res.status(500).json({ error: 'STRIPE_NOT_CONFIGURED', message: 'Stripe is not configured' });
  }
  if (!supabaseAdmin) {
    console.error('[Billing][SUBSCRIPTION_SESSION] Supabase admin not configured');
    return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  }
  const userId = req.headers['x-user-id'];
  if (!userId) {
    console.warn('[Billing][SUBSCRIPTION_SESSION] Missing X-User-Id header');
    return res.status(401).json({ error: 'NO_USER_ID' });
  }

  const { planCode, billingInterval } = req.body || {};
  if (!planCode || (billingInterval !== 'monthly' && billingInterval !== 'yearly')) {
    console.warn('[Billing][SUBSCRIPTION_SESSION] Invalid payload', { planCode, billingInterval });
    return res.status(400).json({ error: 'INVALID_REQUEST', message: 'planCode and billingInterval (monthly|yearly) are required' });
  }

  try {
    // Resolve Organization
    let orgId = req.headers['x-organization-id'];
    if (!orgId) {
      const { data: mem } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (mem) orgId = mem.organization_id;
    }

    if (!orgId) {
      console.warn('[Billing][SUBSCRIPTION_SESSION] No organization found for user', { userId });
      return res.status(400).json({ error: 'NO_ORG_SELECTED', message: 'No active workspace found.' });
    }

    // Load plan configuration
    const { data: plan, error: planError } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('code', planCode)
      .eq('is_active', true)
      .maybeSingle();
    if (planError) {
      console.error('[Billing][SUBSCRIPTION_SESSION] Failed to load plan', planError);
      return res.status(500).json({ error: 'PLAN_LOOKUP_FAILED', message: String(planError.message || planError) });
    }
    if (!plan) {
      console.warn('[Billing][SUBSCRIPTION_SESSION] Plan not found or inactive', { planCode });
      return res.status(400).json({ error: 'PLAN_NOT_FOUND', message: 'Subscription plan not found' });
    }

    const priceId = billingInterval === 'yearly' ? plan.stripe_yearly_price_id : plan.stripe_monthly_price_id;
    if (!priceId) {
      console.warn('[Billing][SUBSCRIPTION_SESSION] Stripe price ID not configured', { planCode, billingInterval });
      return res.status(400).json({ error: 'PRICE_NOT_CONFIGURED', message: 'Stripe price not configured for this plan/billing interval' });
    }

    // Determine customer email
    let customerEmail = null;
    try {
      const { data: userRow } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', userId)
        .maybeSingle();
      customerEmail = userRow?.email || null;
    } catch (e) {
      console.warn('[Billing][SUBSCRIPTION_SESSION] Failed to load user email', e?.message || e);
    }

    // Ensure we have or create a Stripe customer for this org
    let stripeCustomerId = null;
    let existingSub = null;
    try {
      const { data: subRow } = await supabaseAdmin
        .from('organization_subscriptions')
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();
      existingSub = subRow || null;
      if (subRow?.stripe_customer_id) {
        stripeCustomerId = subRow.stripe_customer_id;
      }
    } catch (e) {
      console.warn('[Billing][SUBSCRIPTION_SESSION] Failed to load existing subscription', e?.message || e);
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: customerEmail || undefined,
        metadata: { org_id: String(orgId) },
      });
      stripeCustomerId = customer.id;
    }

    // Upsert organization_subscriptions with basic plan info
    try {
      if (existingSub) {
        await supabaseAdmin
          .from('organization_subscriptions')
          .update({
            plan_id: plan.id,
            plan_code: plan.code,
            stripe_customer_id: stripeCustomerId,
            status: existingSub.status || 'trialing',
          })
          .eq('organization_id', orgId);
      } else {
        await supabaseAdmin
          .from('organization_subscriptions')
          .insert({
            organization_id: orgId,
            plan_id: plan.id,
            plan_code: plan.code,
            stripe_customer_id: stripeCustomerId,
            status: 'trialing',
          });
      }
    } catch (e) {
      console.warn('[Billing][SUBSCRIPTION_SESSION] Failed to upsert organization_subscriptions', e?.message || e);
    }

    const protoHeader = req.headers['x-forwarded-proto'] || 'http';
    const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
    const hostHeader = req.headers.host || `localhost:${PORT}`;
    const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
    const base = `${proto}://${host}`;

    console.log('[Billing][SUBSCRIPTION_SESSION] Creating Stripe Checkout Session', { orgId, planCode, billingInterval });
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price: priceId,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          org_id: String(orgId),
          plan_code: plan.code,
        },
      },
      metadata: {
        org_id: String(orgId),
        plan_code: plan.code,
        user_id: String(userId),
        billing_interval: billingInterval,
      },
      success_url: `${base}/dashboard?sub_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing?checkout_canceled=1`,
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('[Billing][SUBSCRIPTION_SESSION] Error', e);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(e?.message || e) });
  }
});

app.post('/api/billing/subscription/confirm', async (req, res) => {
  console.log('[Billing][SUBSCRIPTION_CONFIRM] Incoming request');
  if (!stripe) {
    console.error('[Billing][SUBSCRIPTION_CONFIRM] STRIPE_SECRET_KEY not configured');
    return res.status(500).json({ error: 'STRIPE_NOT_CONFIGURED', message: 'Stripe is not configured' });
  }
  if (!supabaseAdmin) {
    console.error('[Billing][SUBSCRIPTION_CONFIRM] Supabase admin not configured');
    return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  }
  const userId = req.headers['x-user-id'];
  if (!userId) {
    console.warn('[Billing][SUBSCRIPTION_CONFIRM] Missing X-User-Id header');
    return res.status(401).json({ error: 'NO_USER_ID' });
  }

  const sessionId = (req.body && req.body.sessionId) || (req.query && req.query.sub_session_id);
  if (!sessionId) {
    console.warn('[Billing][SUBSCRIPTION_CONFIRM] Missing sessionId');
    return res.status(400).json({ error: 'MISSING_SESSION_ID', message: 'sessionId is required' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(String(sessionId));
    if (!session) {
      return res.status(404).json({ error: 'SESSION_NOT_FOUND' });
    }

    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : (session.subscription && session.subscription.id);
    if (!subscriptionId) {
      console.warn('[Billing][SUBSCRIPTION_CONFIRM] No subscription on session', { sessionId });
      return res.status(400).json({ error: 'NO_SUBSCRIPTION', message: 'No subscription found on session' });
    }

    const subscription = await stripe.subscriptions.retrieve(String(subscriptionId));
    const meta = {
      ...(session.metadata || {}),
      ...(subscription.metadata || {}),
    };

    let orgId = meta.org_id || null;
    const planCode = meta.plan_code || null;

    // Fallback: derive org from membership if metadata is missing
    if (!orgId) {
      const { data: mem } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (mem) orgId = mem.organization_id;
    }

    if (!orgId) {
      console.warn('[Billing][SUBSCRIPTION_CONFIRM] No organization resolved for subscription', { subscriptionId });
      return res.status(400).json({ error: 'NO_ORG_SELECTED', message: 'No active workspace found.' });
    }

    // Load plan (optional but useful for consistency)
    let plan = null;
    if (planCode) {
      try {
        const { data: planRow } = await supabaseAdmin
          .from('subscription_plans')
          .select('*')
          .eq('code', planCode)
          .maybeSingle();
        plan = planRow || null;
      } catch (e) {
        console.warn('[Billing][SUBSCRIPTION_CONFIRM] Plan lookup failed', e?.message || e);
      }
    }

    const toIso = (ts) => (ts ? new Date(ts * 1000).toISOString() : null);
    const trialStart = toIso(subscription.trial_start);
    const trialEnd = toIso(subscription.trial_end);
    const currentPeriodStart = toIso(subscription.current_period_start);
    const currentPeriodEnd = toIso(subscription.current_period_end);

    // Upsert organization_subscriptions with latest Stripe data
    let existingSub = null;
    try {
      const { data: subRow } = await supabaseAdmin
        .from('organization_subscriptions')
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();
      existingSub = subRow || null;
    } catch (e) {
      console.warn('[Billing][SUBSCRIPTION_CONFIRM] Failed to load existing subscription row', e?.message || e);
    }

    const stripeCustomerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : (subscription.customer && subscription.customer.id) || existingSub?.stripe_customer_id || null;

    const subPayload = {
      plan_id: plan ? plan.id : existingSub?.plan_id || null,
      plan_code: planCode || existingSub?.plan_code || null,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      trial_start: trialStart,
      trial_end: trialEnd,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    };

    try {
      if (existingSub) {
        await supabaseAdmin
          .from('organization_subscriptions')
          .update(subPayload)
          .eq('organization_id', orgId);
      } else {
        await supabaseAdmin
          .from('organization_subscriptions')
          .insert({
            organization_id: orgId,
            ...subPayload,
          });
      }
    } catch (e) {
      console.warn('[Billing][SUBSCRIPTION_CONFIRM] Failed to upsert organization_subscriptions', e?.message || e);
    }

    // Grant one-time trial credits if applicable
    let trialCreditsAdded = 0;
    const trialCredits = 7500;

    try {
      const { data: subRow } = await supabaseAdmin
        .from('organization_subscriptions')
        .select('trial_credits_granted')
        .eq('organization_id', orgId)
        .maybeSingle();

      const alreadyGranted = subRow?.trial_credits_granted === true;

      if (subscription.status === 'trialing' && !alreadyGranted) {
        // Ensure credits row exists
        let balance = 0;
        try {
          const { data: orgCreds } = await supabaseAdmin
            .from('organization_credits')
            .select('balance_credits')
            .eq('organization_id', orgId)
            .maybeSingle();
          balance = orgCreds?.balance_credits ?? 0;
        } catch (e) {
          console.warn('[Billing][SUBSCRIPTION_CONFIRM] Failed to load organization_credits', e?.message || e);
        }

        const newBalance = (balance || 0) + trialCredits;
        try {
          // Insert or update credits row
          const { data: existingCredits } = await supabaseAdmin
            .from('organization_credits')
            .select('organization_id')
            .eq('organization_id', orgId)
            .maybeSingle();

          if (existingCredits) {
            await supabaseAdmin
              .from('organization_credits')
              .update({ balance_credits: newBalance })
              .eq('organization_id', orgId);
          } else {
            await supabaseAdmin
              .from('organization_credits')
              .insert({ organization_id: orgId, balance_credits: newBalance });
          }

          // Log zero-dollar transaction for analytics
          try {
            await supabaseAdmin
              .from('credits_transactions')
              .insert({
                user_id: userId,
                organization_id: orgId,
                amount_cents: 0,
                credits_added: trialCredits,
                status: 'completed',
                metadata: { type: 'trial', subscription_id: subscription.id, session_id: sessionId },
              });
          } catch (e) {
            console.warn('[Billing][SUBSCRIPTION_CONFIRM] Failed to log trial credits transaction', e?.message || e);
          }

          await supabaseAdmin
            .from('organization_subscriptions')
            .update({ trial_credits_granted: true })
            .eq('organization_id', orgId);

          trialCreditsAdded = trialCredits;
        } catch (e) {
          console.warn('[Billing][SUBSCRIPTION_CONFIRM] Failed to grant trial credits', e?.message || e);
        }
      }
    } catch (e) {
      console.warn('[Billing][SUBSCRIPTION_CONFIRM] Trial credits check failed', e?.message || e);
    }

    return res.json({
      ok: true,
      status: subscription.status,
      plan_code: planCode,
      trial_credits_added: trialCreditsAdded,
      trial_end: trialEnd,
    });
  } catch (e) {
    console.error('[Billing][SUBSCRIPTION_CONFIRM] Error', e);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(e?.message || e) });
  }
});

// --- ANALYTICS API ---
app.get('/api/analytics/credits', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });

  try {
    let targetOrgId = orgId;
    // Default to primary org if not specified
    if (!targetOrgId) {
      const { data: mem } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .order('created_at')
        .limit(1)
        .maybeSingle();
      if (mem) targetOrgId = mem.organization_id;
    }

    if (!targetOrgId) {
      return res.json({ history: [] });
    }

    // Fetch recent deductions
    const { data: deductions, error } = await supabaseAdmin
      .from('credit_deductions')
      .select('amount_credits, reason, created_at')
      .eq('organization_id', targetOrgId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;

    res.json({ history: deductions || [] });
  } catch (e) {
    console.error('[Analytics] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: e.message });
  }
});

app.get('/api/analytics/dashboard', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgIdHeader = req.headers['x-organization-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });

  try {
    // 1. Determine context (Org & Role)
    let targetOrgId = orgIdHeader;
    let role = 'member';
    
    const { data: mem } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', userId)
        .order('created_at')
        .limit(1)
        .maybeSingle();

    if (!targetOrgId && mem) targetOrgId = mem.organization_id;
    if (mem && mem.organization_id === targetOrgId) role = mem.role;

    if (!targetOrgId) return res.json({ error: 'No organization found' });

    const isAdmin = role === 'owner' || role === 'admin';

    // 2. Fetch Usage Events
    // Fetch ALL events for the organization to support Admin views.
    // Frontend will filter for "User View".
    
    const { data: events, error } = await supabaseAdmin
        .from('usage_events')
        .select('tool, credits, created_at, user_id, metadata')
        .eq('organization_id', targetOrgId)
        .order('created_at', { ascending: false })
        .limit(2000); // Limit for performance

    if (error) throw error;

    // 3. Process Data
    const tools = {};
    const workflows = {};
    const agents = {};
    const embeds = {};

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    (events || []).forEach(ev => {
        const date = new Date(ev.created_at);
        const isRecent = date >= threeMonthsAgo;
        const credits = ev.credits || 0;
        const toolName = ev.tool || 'unknown';
        const isMyUsage = ev.user_id === userId;

        // Categorize
        let category = 'tool';
        let id = toolName;

        if (toolName.startsWith('workflow:')) {
            category = 'workflow';
            id = toolName.replace('workflow:', '');
        } else if (toolName.startsWith('agent:')) {
            category = 'agent';
            id = toolName.replace('agent:', '');
            if (!ev.user_id) category = 'embed';
        }

        const bucket = category === 'workflow' ? workflows :
                       category === 'agent' ? agents :
                       category === 'embed' ? embeds : tools;

        if (!bucket[id]) {
            bucket[id] = { 
                id, 
                lastUsed: date, 
                lastCredits: credits, 
                totalCredits3m: 0, 
                totalCredits30d: 0,
                totalCredits7d: 0,
                totalCreditsAll: 0, 
                entries: 0,
                userTotal3m: 0,
                userTotal30d: 0,
                userTotal7d: 0,
                userTotalAll: 0
            };
        }
        const item = bucket[id];
        
        if (date > item.lastUsed) {
            item.lastUsed = date;
            item.lastCredits = credits;
        }
        if (isRecent) item.totalCredits3m += credits;
        if (date >= oneMonthAgo) item.totalCredits30d += credits;
        if (date >= oneWeekAgo) item.totalCredits7d += credits;
        item.totalCreditsAll += credits;
        item.entries++;

        if (isMyUsage) {
             if (isRecent) item.userTotal3m += credits;
             if (date >= oneMonthAgo) item.userTotal30d += credits;
             if (date >= oneWeekAgo) item.userTotal7d += credits;
             item.userTotalAll += credits;
        }
    });

    // 4. Fetch Metadata (Names)
    const workflowIds = Object.keys(workflows);
    const agentIds = [...Object.keys(agents), ...Object.keys(embeds)];

    const [wfRes, agRes] = await Promise.all([
        workflowIds.length ? supabaseAdmin.from('workflows').select('id, name').in('id', workflowIds) : { data: [] },
        agentIds.length ? supabaseAdmin.from('agents').select('id, name').in('id', agentIds) : { data: [] }
    ]);

    const wfMap = new Map(wfRes.data?.map(w => [w.id, w.name]) || []);
    const agMap = new Map(agRes.data?.map(a => [a.id, a.name]) || []);

    Object.values(workflows).forEach(w => w.name = wfMap.get(w.id) || 'Unknown Workflow');
    Object.values(agents).forEach(a => a.name = agMap.get(a.id) || 'Unknown Agent');
    Object.values(embeds).forEach(e => e.name = agMap.get(e.id) || 'Unknown Agent');

    // 5. Fetch Storage Stats
    const { data: files } = await supabaseAdmin
        .from('files')
        .select('size')
        .eq('organization_id', targetOrgId);
    
    const totalStorageBytes = files?.reduce((acc, f) => acc + (f.size || 0), 0) || 0;

    const { count: kbCount } = await supabaseAdmin
        .from('knowledge_base')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', targetOrgId);

    res.json({
        isAdmin,
        usage: {
            tools: Object.values(tools).sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed)),
            workflows: Object.values(workflows).sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed)),
            agents: Object.values(agents).sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed)),
            embeds: Object.values(embeds).sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed)),
        },
        storage: {
            filesBytes: totalStorageBytes,
            kbCount: kbCount || 0
        }
    });
  } catch (e) {
    console.error('[Analytics] Dashboard Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: e.message });
  }
});

// --- TEAM MANAGEMENT API ---

// List user's organizations
app.get('/api/teams', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });

  try {
    // 1. Get org IDs where user is a member
    const { data: members, error: memberError } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', userId);

    if (memberError) throw memberError;
    if (!members || members.length === 0) return res.json({ teams: [] });

    const orgIds = members.map((m) => m.organization_id);

    // 2. Get org details
    const { data: orgs, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .in('id', orgIds)
      .order('created_at', { ascending: false });

    if (orgError) throw orgError;

    // Merge role info
    const result = orgs.map((o) => {
      const membership = members.find((m) => m.organization_id === o.id);
      return { ...o, role: membership?.role };
    });

    res.json({ teams: result });
  } catch (err) {
    console.error('[Teams][LIST] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err.message) });
  }
});

// Create organization
app.post('/api/teams', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'MISSING_NAME' });

  try {
    console.log(`[Teams][CREATE] User ${userId} creating team "${name}"`);

    // Check for duplicate name for this user
    const { data: existingOrgs } = await supabaseAdmin
      .from('organization_members')
      .select('organization:organizations!inner(name)') // Use inner join to ensure organization exists
      .eq('user_id', userId)
      .eq('role', 'owner');

    const hasDuplicate = existingOrgs?.some(m => 
      m.organization?.name?.trim().toLowerCase() === name.trim().toLowerCase()
    );

    if (hasDuplicate) {
      return res.status(400).json({ 
        error: 'DUPLICATE_NAME', 
        message: 'You already own a team with this name.' 
      });
    }

    // Create Org
    const { data: org, error: createError } = await supabaseAdmin
      .from('organizations')
      .insert({ name, seat_limit: 5 })
      .select()
      .single();

    if (createError) {
      console.error('[Teams][CREATE] Failed to insert org', createError);
      throw createError;
    }

    console.log(`[Teams][CREATE] Org created ${org.id}. Adding owner...`);

    // Ensure membership
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({ organization_id: org.id, user_id: userId, role: 'owner' })
      .select(); // Adding .select() sometimes helps debug return values
      
    if (memberError) {
      // If duplicate key error (23505), it means trigger might have worked (unexpectedly) or race condition.
      if (memberError.code === '23505') {
        console.log('[Teams][CREATE] Owner already exists (trigger?)');
      } else {
        console.error('[Teams][CREATE] Failed to add owner member', memberError);
        // We might want to delete the org if member add fails to avoid orphans?
        // await supabaseAdmin.from('organizations').delete().eq('id', org.id); 
        throw memberError;
      }
    }

    res.json({ team: { ...org, role: 'owner' } });
  } catch (err) {
    console.error('[Teams][CREATE] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err.message || err) });
  }
});

// Get Team Members
app.get('/api/teams/:id/members', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  const orgId = req.params.id;

  try {
    // Security Check: Caller must be a member
    const { data: membership } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .single();
    
    if (!membership) return res.status(403).json({ error: 'FORBIDDEN' });

    // Fetch members with profiles
    const { data: members, error } = await supabaseAdmin
      .from('organization_members')
      .select(`
        id, role, created_at,
        user:users (id, email)
      `)
      .eq('organization_id', orgId);

    if (error) throw error;

    // Flatten structure
    const result = members.map(m => ({
      id: m.id,
      userId: m.user?.id,
      email: m.user?.email || 'Unknown',
      role: m.role,
      joinedAt: m.created_at
    }));

    res.json({ members: result });
  } catch (err) {
    console.error('[Teams][MEMBERS] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err.message) });
  }
});

// Invite Member
app.post('/api/teams/:id/invite', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  const orgId = req.params.id;
  const { email, role = 'viewer' } = req.body;

  if (!email) return res.status(400).json({ error: 'MISSING_EMAIL' });

  try {
    // Security Check: Caller must be admin/owner
    const { data: caller } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .single();
    
    if (!caller || !['owner', 'admin'].includes(caller.role)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only admins can invite' });
    }

    let seatLimit = null;
    try {
      const { data: subRow } = await supabaseAdmin
        .from('organization_subscriptions')
        .select('plan_id')
        .eq('organization_id', orgId)
        .maybeSingle();
      if (subRow?.plan_id) {
        const { data: plan } = await supabaseAdmin
          .from('subscription_plans')
          .select('seat_limit')
          .eq('id', subRow.plan_id)
          .maybeSingle();
        if (plan && typeof plan.seat_limit === 'number') {
          seatLimit = plan.seat_limit;
        }
      }
    } catch (e) {
      console.warn('[Teams][INVITE] Seat limit lookup failed', e?.message || e);
    }

    if (seatLimit !== null) {
      const { data: members } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('organization_id', orgId);
      const memberCount = members ? members.length : 0;
      if (memberCount >= seatLimit) {
        return res.status(403).json({
          error: 'SEAT_LIMIT_REACHED',
          message: 'This workspace has reached the seat limit for its plan.',
        });
      }
    }

    // Check if user already exists in system
    // Ideally we look up public.users by email, but we might not have email in users table accessible 
    // if RLS blocks it. Admin client bypasses RLS.
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      // Directly add them? Or still invite?
      // For now, let's create an Invitation record.
      // Real app would send an email here.
    }

    const { data: invite, error } = await supabaseAdmin
      .from('invitations')
      .insert({
        organization_id: orgId,
        email,
        role,
        invited_by: userId
      })
      .select()
      .single();

    if (error) throw error;

    // Construct invite link
    const origin = req.headers.origin || 'http://localhost:8080';
    const inviteLink = `${origin}/join?token=${invite.token}`;

    res.json({ 
      ok: true, 
      invitation: invite, 
      inviteLink,
      message: 'Invitation created. Share this link with the user:' 
    });
  } catch (err) {
    console.error('[Teams][INVITE] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err.message) });
  }
});


// Peek Invite
app.get('/api/teams/invite/:token', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const { token } = req.params;
  
  try {
    console.log(`[Teams][PEEK] Checking token: ${token}`);
    const { data: invite, error } = await supabaseAdmin
      .from('invitations')
      .select(`
        id, role, email, expires_at, accepted_at,
        organization:organizations (name)
      `)
      .eq('token', token)
      .single();

    if (error || !invite) {
      console.warn('[Teams][PEEK] Invalid token', error);
      return res.status(404).json({ error: 'INVITE_NOT_FOUND', message: 'Invalid invitation.' });
    }

    if (invite.accepted_at) {
      return res.status(410).json({ error: 'INVITE_USED', message: 'Invitation already used.' });
    }
    
    if (new Date(invite.expires_at) < new Date()) {
       return res.status(410).json({ error: 'INVITE_EXPIRED', message: 'Invitation expired.' });
    }

    res.json({ 
      invite: {
        email: invite.email,
        role: invite.role,
        teamName: invite.organization?.name || 'Team'
      }
    });
  } catch (err) {
    console.error('[Teams][PEEK] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Join Team (Accept Invite)
app.post('/api/teams/join', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'MISSING_TOKEN' });

  try {
    // 0. Ensure public profile exists (Fix for missing trigger)
    const { data: profile } = await supabaseAdmin.from('users').select('id').eq('id', userId).maybeSingle();
    if (!profile) {
      console.log(`[Teams][JOIN] Missing public profile for ${userId}. Creating...`);
      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (authError || !authUser) {
        console.error('[Teams][JOIN] Auth user not found', authError);
        return res.status(401).json({ error: 'AUTH_INVALID', message: 'Your session appears invalid or expired. Please Sign Out and Sign In again.' });
      }
      // Create profile
      const { error: createError } = await supabaseAdmin.from('users').insert({ id: userId, email: authUser.email });
      if (createError) {
        // Ignore if race condition
         if (createError.code !== '23505') {
             console.error('[Teams][JOIN] Failed to create profile', createError);
             throw createError;
         }
      }
    }

    // 1. Find Invitation
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('token', token)
      .is('accepted_at', null) // Only unused invites
      .gt('expires_at', new Date().toISOString()) // Not expired
      .single();

    if (inviteError || !invite) {
      return res.status(404).json({ error: 'INVALID_INVITE', message: 'Invitation not found, expired, or already used.' });
    }

    let seatLimit = null;
    try {
      const { data: subRow } = await supabaseAdmin
        .from('organization_subscriptions')
        .select('plan_id')
        .eq('organization_id', invite.organization_id)
        .maybeSingle();
      if (subRow?.plan_id) {
        const { data: plan } = await supabaseAdmin
          .from('subscription_plans')
          .select('seat_limit')
          .eq('id', subRow.plan_id)
          .maybeSingle();
        if (plan && typeof plan.seat_limit === 'number') {
          seatLimit = plan.seat_limit;
        }
      }
    } catch (e) {
      console.warn('[Teams][JOIN] Seat limit lookup failed', e?.message || e);
    }

    if (seatLimit !== null) {
      const { data: members } = await supabaseAdmin
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', invite.organization_id);
      const list = members || [];
      const alreadyMember = list.some((m) => m.user_id === userId);
      if (!alreadyMember && list.length >= seatLimit) {
        return res.status(403).json({
          error: 'SEAT_LIMIT_REACHED',
          message: 'This workspace has reached the seat limit for its plan.',
        });
      }
    }

    // 2. Add Member
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: invite.organization_id,
        user_id: userId,
        role: invite.role
      });

    if (memberError) {
      // If already member, just consume invite?
      if (memberError.code !== '23505') throw memberError;
    }

    // 3. Mark Accepted
    await supabaseAdmin
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    res.json({ ok: true, teamId: invite.organization_id });

  } catch (err) {
    console.error('[Teams][JOIN] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err.message) });
  }
});


// Get Team Credits
app.get('/api/teams/:id/credits', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  const orgId = req.params.id;

  try {
    // Security: User must be member of org
    const { data: mem } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();
      
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { data, error } = await supabaseAdmin
      .from('organization_credits')
      .select('balance_credits, total_spent_usd')
      .eq('organization_id', orgId)
      .maybeSingle();
    
    if (error) throw error;

    res.json({ 
      balance_credits: data?.balance_credits ?? 0,
      total_spent_usd: data?.total_spent_usd ?? 0
    });
  } catch (err) {
    console.error('[Teams][CREDITS] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});


// ==========================================
// Project Management API
// ==========================================

// List Projects
app.get('/api/projects', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];

  if (!userId || !orgId) return res.status(400).json({ error: 'MISSING_CONTEXT' });

  try {
    // Security check
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('*, tasks(count), tags:project_tags(tag:tags(*))')
      .eq('organization_id', orgId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    
    const projects = data.map(p => ({
        ...p,
        tags: p.tags ? p.tags.map(t => t.tag) : []
    }));
    
    res.json({ projects });
  } catch (err) {
    console.error('[Projects][LIST] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Create Project
app.post('/api/projects', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const { name, description, status } = req.body;

  if (!userId || !orgId) return res.status(400).json({ error: 'MISSING_CONTEXT' });

  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    // Uniqueness Check
    const { data: existing } = await supabaseAdmin.from('projects').select('id').eq('organization_id', orgId).ilike('name', name).maybeSingle();
    if (existing) return res.status(409).json({ error: 'DUPLICATE', message: 'Project name already exists' });

    const { data, error } = await supabaseAdmin
      .from('projects')
      .insert({
        organization_id: orgId,
        name,
        description,
        status: status || 'active'
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ project: data });
  } catch (err) {
    console.error('[Projects][CREATE] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// List Project Assets
app.get('/api/projects/:id/assets', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const projectId = req.params.id;
  
  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { data, error } = await supabaseAdmin
        .from('project_assets')
        .select('*, asset:assets(*)')
        .eq('project_id', projectId);
        
    if (error) throw error;
    res.json({ assets: data.map(d => d.asset) });
  } catch(e) {
    console.error('[Projects][ASSETS] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Attach Asset to Project
app.post('/api/projects/:id/assets', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const projectId = req.params.id;
  const { assetId } = req.body;
  
  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { error } = await supabaseAdmin
        .from('project_assets')
        .insert({ project_id: projectId, asset_id: assetId });
        
    if (error) throw error;
    res.json({ ok: true });
  } catch(e) {
    console.error('[Projects][ATTACH] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Detach Asset from Project
app.delete('/api/projects/:id/assets/:assetId', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const projectId = req.params.id;
  const assetId = req.params.assetId;
  
  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { error } = await supabaseAdmin
        .from('project_assets')
        .delete()
        .eq('project_id', projectId)
        .eq('asset_id', assetId);
        
    if (error) throw error;
    res.json({ ok: true });
  } catch(e) {
    console.error('[Projects][DETACH] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Get Project
app.get('/api/projects/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const projectId = req.params.id;
  
  console.log(`[Projects][GET] Request for id=${projectId} org=${orgId}`);

  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) {
        console.warn('[Projects][GET] Not a member');
        return res.status(403).json({ error: 'FORBIDDEN' });
    }

    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('*, tags:project_tags(tag:tags(*))')
      .eq('id', projectId)
      .single();

    if (error) {
        console.error('[Projects][GET] DB Error', error);
        throw error;
    }
    if (!data || data.organization_id !== orgId) {
        console.warn('[Projects][GET] Not found or org mismatch', { found: !!data });
        return res.status(404).json({ error: 'NOT_FOUND' });
    }

    if (data.tags) {
        data.tags = data.tags.map(t => t.tag);
    }

    res.json({ project: data });
  } catch (err) {
    console.error('[Projects][GET] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Update Project
app.patch('/api/projects/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const projectId = req.params.id;
  const updates = req.body;

  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { data, error } = await supabaseAdmin
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;
    res.json({ project: data });
  } catch (err) {
    console.error('[Projects][UPDATE] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Attach Tag to Project
app.post('/api/projects/:id/tags', async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
    const userId = req.headers['x-user-id'];
    const orgId = req.headers['x-organization-id'];
    const projectId = req.params.id;
    const { tagId } = req.body;
    
    try {
        const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
        if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });
        
        const { error } = await supabaseAdmin.from('project_tags').insert({ project_id: projectId, tag_id: tagId });
        if (error) throw error;
        res.json({ ok: true });
    } catch(e) {
        console.error('[Projects][TAG] Error', e);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
});

// Detach Tag from Project
app.delete('/api/projects/:id/tags/:tagId', async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
    const userId = req.headers['x-user-id'];
    const orgId = req.headers['x-organization-id'];
    const projectId = req.params.id;
    const tagId = req.params.tagId;
    
    try {
        const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
        if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });
        
        const { error } = await supabaseAdmin.from('project_tags').delete().eq('project_id', projectId).eq('tag_id', tagId);
        if (error) throw error;
        res.json({ ok: true });
    } catch(e) {
        console.error('[Projects][UNTAG] Error', e);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
});

// List Tasks
app.get('/api/projects/:id/tasks', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const projectId = req.params.id;

  try {
    // Check project exists & belongs to org
    const { data: project } = await supabaseAdmin.from('projects').select('organization_id').eq('id', projectId).single();
    if (!project || project.organization_id !== orgId) return res.status(404).json({ error: 'NOT_FOUND' });

    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .select('*, assignee:users(id, email), tags:task_tags(tag:tags(*))')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    const tasks = data.map(t => ({
        ...t,
        tags: t.tags ? t.tags.map(tt => tt.tag) : []
    }));
    
    res.json({ tasks });
  } catch (err) {
    console.error('[Tasks][LIST] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Attach Tag to Task
app.post('/api/tasks/:id/tags', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const taskId = req.params.id;
  const { tagId } = req.body;
  
  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { error } = await supabaseAdmin.from('task_tags').insert({ task_id: taskId, tag_id: tagId });
    if (error) throw error;
    res.json({ ok: true });
  } catch(e) {
    console.error('[Tasks][TAG] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Detach Tag from Task
app.delete('/api/tasks/:id/tags/:tagId', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const taskId = req.params.id;
  const tagId = req.params.tagId;
  
  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { error } = await supabaseAdmin.from('task_tags').delete().eq('task_id', taskId).eq('tag_id', tagId);
    if (error) throw error;
    res.json({ ok: true });
  } catch(e) {
    console.error('[Tasks][UNTAG] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Create Task
app.post('/api/projects/:id/tasks', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const projectId = req.params.id;
  const { title, description, priority, assignee_id, due_date } = req.body;

  try {
    const { data: project } = await supabaseAdmin.from('projects').select('organization_id').eq('id', projectId).single();
    if (!project || project.organization_id !== orgId) return res.status(403).json({ error: 'FORBIDDEN' });
    
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .insert({
        project_id: projectId,
        title,
        description,
        priority: priority || 'medium',
        assignee_id: assignee_id || null,
        due_date: due_date || null,
        status: 'todo'
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ task: data });
  } catch (err) {
    console.error('[Projects][CREATE_TASK] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Update Task
app.patch('/api/tasks/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const taskId = req.params.id;
  const updates = req.body; // status, priority, assignee_id, etc.

  try {
    // Need to verify task belongs to project which belongs to org
    const { data: task } = await supabaseAdmin
        .from('tasks')
        .select('project_id, project:projects(organization_id)')
        .eq('id', taskId)
        .single();
        
    if (!task || !task.project || task.project.organization_id !== orgId) {
         return res.status(403).json({ error: 'FORBIDDEN' });
    }
    
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
    res.json({ task: data });
  } catch (err) {
    console.error('[Projects][UPDATE_TASK] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Delete Task
app.delete('/api/tasks/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const taskId = req.params.id;

  try {
    const { data: task } = await supabaseAdmin
        .from('tasks')
        .select('project_id, project:projects(organization_id)')
        .eq('id', taskId)
        .single();
        
    if (!task || !task.project || task.project.organization_id !== orgId) {
         return res.status(403).json({ error: 'FORBIDDEN' });
    }
    
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { error } = await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[Projects][DELETE_TASK] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});


// ==========================================
// Asset/File Management API
// ==========================================

// List Assets (with filters)
app.get('/api/assets', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const { projectId, folderId, search, type } = req.query;

  if (!userId || !orgId) return res.status(400).json({ error: 'MISSING_CONTEXT' });

  try {
     // Security
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    let query = supabaseAdmin
      .from('assets')
      .select('*, tags:asset_tags(tag:tags(*))')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    
    // If search is active, ignore folder filter to search globally
    if (!search) {
      if (folderId && folderId !== 'null') {
        query = query.eq('folder_id', folderId);
      } else if (folderId === 'null') {
        query = query.is('folder_id', null);
      }
    }
    
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    if (type) {
      if (type === 'image') query = query.ilike('file_type', 'image/%');
      else if (type === 'document') query = query.ilike('file_type', '%pdf%'); 
    }

    const { data, error } = await query;
    if (error) throw error;
    
    const assets = data.map(a => ({
        ...a,
        tags: a.tags ? a.tags.map(t => t.tag) : []
    }));
    res.json({ assets });
  } catch (err) {
    console.error('[Assets][LIST] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Attach Tag to Asset
app.post('/api/assets/:id/tags', async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
    const userId = req.headers['x-user-id'];
    const orgId = req.headers['x-organization-id'];
    const assetId = req.params.id;
    const { tagId } = req.body;
    
    try {
        const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
        if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });
        
        const { error } = await supabaseAdmin.from('asset_tags').insert({ asset_id: assetId, tag_id: tagId });
        if (error) throw error;
        res.json({ ok: true });
    } catch(e) {
        console.error('[Assets][TAG] Error', e);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
});

// Detach Tag from Asset
app.delete('/api/assets/:id/tags/:tagId', async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
    const userId = req.headers['x-user-id'];
    const orgId = req.headers['x-organization-id'];
    const assetId = req.params.id;
    const tagId = req.params.tagId;
    
    try {
        const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
        if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });
        
        const { error } = await supabaseAdmin.from('asset_tags').delete().eq('asset_id', assetId).eq('tag_id', tagId);
        if (error) throw error;
        res.json({ ok: true });
    } catch(e) {
        console.error('[Assets][UNTAG] Error', e);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
});

// List Folders
app.get('/api/folders', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const parentId = req.query.parentId;

  if (!userId || !orgId) return res.status(400).json({ error: 'MISSING_CONTEXT' });

  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    let query = supabaseAdmin
      .from('folders')
      .select('*, tags:folder_tags(tag:tags(*))')
      .eq('organization_id', orgId)
      .order('name', { ascending: true });
      
    if (parentId && parentId !== 'null') {
        query = query.eq('parent_id', parentId);
    } else {
        query = query.is('parent_id', null);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    const folders = data.map(f => ({
        ...f,
        tags: f.tags ? f.tags.map(t => t.tag) : []
    }));
    res.json({ folders });
  } catch (err) {
    console.error('[Folders][LIST] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Attach Tag to Folder
app.post('/api/folders/:id/tags', async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
    const userId = req.headers['x-user-id'];
    const orgId = req.headers['x-organization-id'];
    const folderId = req.params.id;
    const { tagId } = req.body;
    
    try {
        const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
        if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });
        
        const { error } = await supabaseAdmin.from('folder_tags').insert({ folder_id: folderId, tag_id: tagId });
        if (error) throw error;
        res.json({ ok: true });
    } catch(e) {
        console.error('[Folders][TAG] Error', e);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
});

// Detach Tag from Folder
app.delete('/api/folders/:id/tags/:tagId', async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
    const userId = req.headers['x-user-id'];
    const orgId = req.headers['x-organization-id'];
    const folderId = req.params.id;
    const tagId = req.params.tagId;
    
    try {
        const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
        if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });
        
        const { error } = await supabaseAdmin.from('folder_tags').delete().eq('folder_id: folderId').eq('tag_id', tagId); // Typo fixed in manual string below
        const { error: dbError } = await supabaseAdmin.from('folder_tags').delete().eq('folder_id', folderId).eq('tag_id', tagId);
        if (dbError) throw dbError;
        res.json({ ok: true });
    } catch(e) {
        console.error('[Folders][UNTAG] Error', e);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
});

// Create Folder
app.post('/api/folders', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const { name, parentId, categoryId } = req.body;

  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    // Uniqueness Check
    let q = supabaseAdmin.from('folders').select('id').eq('organization_id', orgId).ilike('name', name);
    if (parentId) q = q.eq('parent_id', parentId);
    else q = q.is('parent_id', null);
    
    const { data: existing } = await q.maybeSingle();
    if (existing) return res.status(409).json({ error: 'DUPLICATE', message: 'Folder name already exists in this location' });

    const { data, error } = await supabaseAdmin
      .from('folders')
      .insert({
        organization_id: orgId,
        name,
        parent_id: parentId || null,
        category_id: categoryId || null
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ folder: data });
  } catch (err) {
    console.error('[Folders][CREATE] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Delete Folder
app.delete('/api/folders/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const folderId = req.params.id;
  const deleteContent = req.query.deleteContent === 'true';

  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    if (deleteContent) {
       // Delete files in this folder
       const { data: assets } = await supabaseAdmin.from('assets').select('id, storage_path').eq('folder_id', folderId);
       if (assets && assets.length > 0) {
           const paths = assets.map(a => a.storage_path);
           await supabaseAdmin.storage.from('assets').remove(paths);
           await supabaseAdmin.from('assets').delete().eq('folder_id', folderId);
       }
    }

    const { error } = await supabaseAdmin.from('folders').delete().eq('id', folderId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[Folders][DELETE] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Delete Asset
app.delete('/api/assets/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const assetId = req.params.id;

  try {
     // Security + Get Path
    const { data: asset } = await supabaseAdmin
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single();
    
    if (!asset || asset.organization_id !== orgId) return res.status(404).json({ error: 'NOT_FOUND' });

    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    // 1. Delete from Storage
    const { error: storageError } = await supabaseAdmin.storage
      .from('assets')
      .remove([asset.storage_path]);
    
    if (storageError) console.warn('[Assets][DELETE] Storage delete failed', storageError);

    // 2. Delete Metadata
    const { error } = await supabaseAdmin.from('assets').delete().eq('id', assetId);
    if (error) throw error;

    res.json({ ok: true });
  } catch (err) {
    console.error('[Assets][DELETE] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});


// ==========================================
// Task Attachments API
// ==========================================

// List Task Assets
app.get('/api/tasks/:id/assets', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const taskId = req.params.id;

  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { data, error } = await supabaseAdmin
      .from('task_assets')
      .select('asset:assets(*)')
      .eq('task_id', taskId);

    if (error) throw error;
    const assets = data.map(d => d.asset);
    res.json({ assets });
  } catch (err) {
    console.error('[TaskAssets][LIST] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Attach Asset
app.post('/api/tasks/:id/assets', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const taskId = req.params.id;
  const { assetId } = req.body;

  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { error } = await supabaseAdmin
      .from('task_assets')
      .insert({ task_id: taskId, asset_id: assetId });

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[TaskAssets][ATTACH] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Detach Asset
app.delete('/api/tasks/:id/assets/:assetId', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const taskId = req.params.id;
  const assetId = req.params.assetId;

  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { error } = await supabaseAdmin
      .from('task_assets')
      .delete()
      .eq('task_id', taskId)
      .eq('asset_id', assetId);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[TaskAssets][DETACH] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Rename Folder
app.patch('/api/folders/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const folderId = req.params.id;
  const { name } = req.body;

  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { error } = await supabaseAdmin.from('folders').update({ name }).eq('id', folderId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[Folders][UPDATE] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// List Categories
app.get('/api/categories', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  if (!userId || !orgId) return res.status(400).json({ error: 'MISSING_CONTEXT' });
  
  try {
     const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
     if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

     const { data, error } = await supabaseAdmin.from('categories').select('*').eq('organization_id', orgId).order('name');
     if (error) throw error;
     res.json({ categories: data });
  } catch (err) {
    console.error('[Categories][LIST] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Create Category
app.post('/api/categories', async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
    const userId = req.headers['x-user-id'];
    const orgId = req.headers['x-organization-id'];
    const { name } = req.body;
    
    if (!name) return res.status(400).json({ error: 'MISSING_NAME' });

    try {
        const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
        if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });
        
        // Uniqueness Check
        const { data: existing } = await supabaseAdmin
          .from('categories')
          .select('id')
          .eq('organization_id', orgId)
          .ilike('name', name)
          .maybeSingle();
          
        if (existing) return res.status(409).json({ error: 'DUPLICATE', message: 'Category name already exists' });

        const { data, error } = await supabaseAdmin
          .from('categories')
          .insert({ organization_id: orgId, name })
          .select()
          .single();

        if (error) throw error;
        res.json({ category: data });
    } catch(e) {
        console.error('[Categories][CREATE] Error', e);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
});

// List Tags
app.get('/api/tags', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  if (!userId || !orgId) return res.status(400).json({ error: 'MISSING_CONTEXT' });
  
  try {
     const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
     if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

     const { data, error } = await supabaseAdmin.from('tags').select('*').eq('organization_id', orgId).order('name');
     if (error) throw error;
     res.json({ tags: data });
  } catch (err) {
    console.error('[Tags][LIST] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Create Tag
app.post('/api/tags', async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
    const userId = req.headers['x-user-id'];
    const orgId = req.headers['x-organization-id'];
    const { name } = req.body;
    
    try {
        const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
        if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });
        
        const { data, error } = await supabaseAdmin.from('tags').insert({ organization_id: orgId, name }).select().single();
        if (error) throw error;
        res.json({ tag: data });
    } catch(e) {
        console.error('[Tags][CREATE] Error', e);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
});

// Update Tag
app.patch('/api/tags/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const tagId = req.params.id;
  const { name } = req.body;

  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { error } = await supabaseAdmin.from('tags').update({ name }).eq('id', tagId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[Tags][UPDATE] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Delete Tag
app.delete('/api/tags/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const tagId = req.params.id;

  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { error } = await supabaseAdmin.from('tags').delete().eq('id', tagId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[Tags][DELETE] Error', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ==========================================
// Custom Templates
// ==========================================

// List Templates
app.get('/api/templates', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  
  try {
    // Auth check
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { data, error } = await supabaseAdmin
        .from('content_templates')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
        
    if (error) throw error;
    res.json({ templates: data });
  } catch (e) {
    console.error('[Templates][LIST] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Create Template
app.post('/api/templates', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const { name, description, schema, prompt_text, category, icon } = req.body;

  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem || !['owner', 'admin', 'editor'].includes(mem.role)) return res.status(403).json({ error: 'FORBIDDEN' });

    const { data, error } = await supabaseAdmin
        .from('content_templates')
        .insert({ 
            organization_id: orgId, 
            name, description, schema, prompt_text, category, icon, 
            created_by: userId 
        })
        .select()
        .single();

    if (error) throw error;
    res.json({ template: data });
  } catch (e) {
    console.error('[Templates][CREATE] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Update Template
app.put('/api/templates/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const templateId = req.params.id;
  const updates = req.body;

  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem || !['owner', 'admin', 'editor'].includes(mem.role)) return res.status(403).json({ error: 'FORBIDDEN' });

    const { data, error } = await supabaseAdmin
        .from('content_templates')
        .update(updates)
        .eq('id', templateId)
        .eq('organization_id', orgId)
        .select()
        .single();

    if (error) throw error;
    res.json({ template: data });
  } catch (e) {
    console.error('[Templates][UPDATE] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Delete Template
app.delete('/api/templates/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const templateId = req.params.id;

  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem || !['owner', 'admin', 'editor'].includes(mem.role)) return res.status(403).json({ error: 'FORBIDDEN' });

    const { error } = await supabaseAdmin
        .from('content_templates')
        .delete()
        .eq('id', templateId)
        .eq('organization_id', orgId);

    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.error('[Templates][DELETE] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Generate from Template
app.post('/api/generate-template', generateLimiter, async (req, res) => {
  if (!genAI) return res.status(500).json({ error: 'AI_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const { templateId, inputs, outputCount = 3 } = req.body;

  try {
    // Fetch template
    const { data: template } = await supabaseAdmin
        .from('content_templates')
        .select('*')
        .eq('id', templateId)
        .single();
    
    if (!template) return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND' });
    if (template.organization_id !== orgId) return res.status(403).json({ error: 'FORBIDDEN' });

    // Build Prompt
    let prompt = template.prompt_text;
    // Interpolate inputs: {{key}}
    for (const [key, val] of Object.entries(inputs)) {
        prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), String(val));
    }
    
    const finalPrompt = `${prompt}\n\nGenerate ${outputCount} variations. Return strictly valid JSON array of objects with field 'text'.`;

    // Generate
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const model = genAI.getGenerativeModel({ model: modelName });
    const { text, attempts } = await generateWithRetry(model, finalPrompt, 3);

    // Parse JSON
    let parsedJson = null;
    try {
      parsedJson = JSON.parse(text);
    } catch (e) {
      const match = text.match(/\[.*\]|\{.*\}/s);
      if (match) {
        try { parsedJson = JSON.parse(match[0]); } catch (err) { parsedJson = null; }
      }
    }
    
    // Fallback if not JSON
    if (!parsedJson) {
        parsedJson = [{ text: stripBasicMarkdown(text) }];
    }
    
    // Ensure array
    const results = Array.isArray(parsedJson) ? parsedJson : [parsedJson];

    res.json({ results });

  } catch (e) {
    console.error('[Templates][GENERATE] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ==========================================
// Team Chat
// ==========================================

// List Threads
app.get('/api/chat/threads', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  
  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    const { data, error } = await supabaseAdmin
        .from('chat_threads')
        .select('*, created_by_user:users(email)')
        .eq('organization_id', orgId)
        .order('updated_at', { ascending: false });
        
    if (error) throw error;
    res.json({ threads: data });
  } catch (e) {
    console.error('[Chat][THREADS] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Create Thread
app.post('/api/chat/threads', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const { topic } = req.body;

  try {
    const { data: mem } = await supabaseAdmin.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'FORBIDDEN' });

    // Check duplicates
    const { data: existing } = await supabaseAdmin
      .from('chat_threads')
      .select('id')
      .eq('organization_id', orgId)
      .eq('topic', topic)
      .maybeSingle();
      
    if (existing) {
        return res.status(400).json({ error: 'DUPLICATE_TOPIC', message: 'A chat with this name already exists in the team.' });
    }

    const { data, error } = await supabaseAdmin
        .from('chat_threads')
        .insert({ organization_id: orgId, topic, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    res.json({ thread: data });
  } catch (e) {
    console.error('[Chat][CREATE_THREAD] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// List Messages
app.get('/api/chat/threads/:id/messages', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const threadId = req.params.id;

  try {
    // Verify Access
    const { data: thread } = await supabaseAdmin.from('chat_threads').select('organization_id').eq('id', threadId).single();
    if (!thread || thread.organization_id !== orgId) return res.status(403).json({ error: 'FORBIDDEN' });

    const { data, error } = await supabaseAdmin
        .from('chat_messages')
        .select('*, user:users(email)')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ messages: data });
  } catch (e) {
    console.error('[Chat][MESSAGES] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Send Message (User only, no Auto-AI)
app.post('/api/chat/threads/:id/messages', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const threadId = req.params.id;
  const { content } = req.body;

  try {
    // Verify Access
    const { data: thread } = await supabaseAdmin.from('chat_threads').select('organization_id').eq('id', threadId).single();
    if (!thread || thread.organization_id !== orgId) return res.status(403).json({ error: 'FORBIDDEN' });

    // Insert User Message
    const { data: userMsg, error: userError } = await supabaseAdmin
        .from('chat_messages')
        .insert({ thread_id: threadId, user_id: userId, role: 'user', content })
        .select()
        .single();

    if (userError) throw userError;

    // Update Thread timestamp
    await supabaseAdmin.from('chat_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId);

    res.json({ message: userMsg });

  } catch (e) {
    console.error('[Chat][SEND] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ------------------------------------------------------------------
// Brand Voice APIs
// ------------------------------------------------------------------

// List Brand Voices
app.get('/api/brand-voices', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const orgId = req.headers['x-organization-id'];
  if (!orgId) return res.status(400).json({ error: 'NO_ORG_ID' });

  try {
    const { data, error } = await supabaseAdmin
      .from('brand_voices')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json({ voices: data });
  } catch (e) {
    console.error('[BrandVoice][LIST] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Get Single Voice
app.get('/api/brand-voices/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const orgId = req.headers['x-organization-id'];
  const id = req.params.id;
  if (!orgId) return res.status(400).json({ error: 'NO_ORG_ID' });

  try {
    const { data, error } = await supabaseAdmin
      .from('brand_voices')
      .select('*, brand_voice_samples(*)')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();
    
    if (error) throw error;
    res.json({ voice: data });
  } catch (e) {
    console.error('[BrandVoice][GET] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Create Brand Voice
app.post('/api/brand-voices', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const orgId = req.headers['x-organization-id'];
  const userId = req.headers['x-user-id'];
  if (!orgId || !userId) return res.status(400).json({ error: 'MISSING_HEADERS' });
  
  const { name, description, tone_tags, rules } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  try {
    // Insert Voice
    const { data, error } = await supabaseAdmin
      .from('brand_voices')
      .insert({
        organization_id: orgId,
        created_by: userId,
        name,
        description,
        tone_tags: tone_tags || [],
        rules: rules || { dos: [], donts: [] }
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ voice: data });
  } catch (e) {
    console.error('[BrandVoice][CREATE] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Update Brand Voice
app.put('/api/brand-voices/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const orgId = req.headers['x-organization-id'];
  const id = req.params.id;
  const { name, description, tone_tags, rules } = req.body;

  try {
    // Check permissions (RLS enforces logic, but explicit check handles 404/403 better)
    const { data, error } = await supabaseAdmin
      .from('brand_voices')
      .update({
        name,
        description,
        tone_tags,
        rules,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) throw error;
    res.json({ voice: data });
  } catch (e) {
    console.error('[BrandVoice][UPDATE] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Delete Brand Voice
app.delete('/api/brand-voices/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const orgId = req.headers['x-organization-id'];
  const id = req.params.id;

  try {
    const { error } = await supabaseAdmin
      .from('brand_voices')
      .delete()
      .eq('id', id)
      .eq('organization_id', orgId);

    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.error('[BrandVoice][DELETE] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Add Sample
app.post('/api/brand-voices/:id/samples', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const orgId = req.headers['x-organization-id'];
  const voiceId = req.params.id;
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });

  try {
    // Verify voice belongs to org
    const { data: voice } = await supabaseAdmin.from('brand_voices').select('id').eq('id', voiceId).eq('organization_id', orgId).single();
    if (!voice) return res.status(404).json({ error: 'Voice not found' });

    const { data, error } = await supabaseAdmin
      .from('brand_voice_samples')
      .insert({ voice_id: voiceId, content })
      .select()
      .single();

    if (error) throw error;
    res.json({ sample: data });
  } catch (e) {
    console.error('[BrandVoice][ADD_SAMPLE] Error', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Delete Sample
app.delete('/api/brand-voices/:id/samples/:sampleId', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  const orgId = req.headers['x-organization-id'];
  const { id: voiceId, sampleId } = req.params;

  try {
    // Check ownership via join or verify voice first.
    // We can just delete where id=sampleId and exists(voice with orgId).
    // Or simple check:
    const { error } = await supabaseAdmin
      .from('brand_voice_samples')
      .delete()
      .eq('id', sampleId)
      .eq('voice_id', voiceId); // RLS policy handles org check effectively if user token passed, but here we are admin.
      // Wait, supabaseAdmin bypasses RLS. We MUST check org manually.
      
    // Safe delete:
    // 1. Check Voice
    const { data: voice } = await supabaseAdmin.from('brand_voices').select('id').eq('id', voiceId).eq('organization_id', orgId).single();
    if (!voice) return res.status(403).json({ error: 'FORBIDDEN' });

    // 2. Delete
    const { error: delError } = await supabaseAdmin.from('brand_voice_samples').delete().eq('id', sampleId);
    if (delError) throw delError;

    res.json({ ok: true });
  } catch (e) {
  }
});

app.post('/api/knowledge/ingest', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const { title, text } = req.body;

  if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });
  if (!title || !text) return res.status(400).json({ error: 'Missing title or text' });

  try {
    const result = await ingestDocument(orgId, title, text);
    res.json(result);
  } catch (e) {
    if (e.code === '23505') {
        return res.status(409).json({ error: 'A file with this title already exists.' });
    }
    console.error("Ingest Error", e);
    res.status(500).json({ error: e.message });
  }
});

Sentry.setupExpressErrorHandler(app);

// ============================================
// API v1 - Programmatic Access (Business Tier)
// ============================================

// In-memory rate limiter
const apiRateLimitMap = new Map();
const API_RATE_LIMIT = { perMinute: 100, perDay: 10000 };

// API Key validation middleware
async function validateApiKeyMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const apiKey = authHeader.replace(/^Bearer\s+/i, '');

    if (!apiKey) {
        console.warn('[API v1] Missing Authorization header');
        return res.status(401).json({ 
            error: 'UNAUTHORIZED', 
            message: 'Missing Authorization header. Use: Authorization: Bearer <API_KEY>' 
        });
    }

    if (!supabaseAdmin) {
        return res.status(500).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }

    const { data, error } = await supabaseAdmin
        .from('organization_api_keys')
        .select('id, organization_id, name, organizations(id, name, subscription_tier)')
        .eq('public_key', apiKey)
        .single();

    if (error || !data) {
        console.warn('[API v1] Invalid API key:', apiKey?.substring(0, 10) + '...');
        return res.status(401).json({ error: 'INVALID_API_KEY', message: 'Invalid API key' });
    }

    const org = data.organizations;
    if (!org || !['business', 'enterprise'].includes(org.subscription_tier?.toLowerCase())) {
        console.warn('[API v1] API access requires Business tier. Org tier:', org?.subscription_tier);
        return res.status(403).json({ 
            error: 'API_ACCESS_REQUIRES_BUSINESS_TIER', 
            message: 'API access requires Business tier subscription.' 
        });
    }

    req.apiKeyId = data.id;
    req.orgId = data.organization_id;
    req.orgName = org.name;
    console.log(`[API v1] Authenticated: ${data.name} (Org: ${org.name})`);
    next();
}

// Rate limiter check
function checkApiRateLimit(keyId) {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const day = Math.floor(now / 86400000);

    let entry = apiRateLimitMap.get(keyId);
    if (!entry || entry.windowStart !== minute) {
        entry = { count: 0, windowStart: minute, dailyCount: entry?.dayStart === day ? entry.dailyCount : 0, dayStart: day };
    }

    if (entry.dailyCount >= API_RATE_LIMIT.perDay || entry.count >= API_RATE_LIMIT.perMinute) {
        return { allowed: false, remaining: 0 };
    }

    entry.count++;
    entry.dailyCount++;
    apiRateLimitMap.set(keyId, entry);
    return { allowed: true, remaining: API_RATE_LIMIT.perMinute - entry.count };
}

// GET /api/v1/tools - List available tools (public)
app.get('/api/v1/tools', (req, res) => {
    const TOOLS = [
        { name: 'email_subject', description: 'Generate email subject lines', category: 'email' },
        { name: 'cold_email', description: 'Write cold outreach emails', category: 'email' },
        { name: 'linkedin', description: 'LinkedIn post generator', category: 'social' },
        { name: 'twitter_thread', description: 'Twitter/X thread generator', category: 'social' },
        { name: 'product_description', description: 'E-commerce product descriptions', category: 'marketing' },
        { name: 'blog_post', description: 'Full blog post generator', category: 'long-form' },
        { name: 'summarizer', description: 'Text summarization', category: 'utility' },
        { name: 'rewrite_helper', description: 'Rewrite and improve text', category: 'utility' },
    ];
    console.log('[API v1] Tools list requested');
    res.json({ tools: TOOLS, total: TOOLS.length });
});

// POST /api/v1/generate - Generate content (requires Business tier)
app.post('/api/v1/generate', validateApiKeyMiddleware, async (req, res) => {
    const rateLimit = checkApiRateLimit(req.apiKeyId);
    res.setHeader('X-RateLimit-Limit', API_RATE_LIMIT.perMinute.toString());
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());

    if (!rateLimit.allowed) {
        console.warn(`[API v1] Rate limit exceeded for ${req.orgName}`);
        return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded. Try again later.' });
    }

    const { tool, inputs, options } = req.body || {};
    if (!tool || !inputs) {
        return res.status(400).json({ error: 'INVALID_REQUEST', message: 'Request body must include "tool" and "inputs"' });
    }

    console.log(`[API v1] Generate request: tool=${tool}, org=${req.orgName}`);

    try {
        // Reuse internal generate logic (simplified - forward to existing route handler)
        // In production, extract the core logic into a shared function
        const result = { message: 'API v1 generate endpoint configured. Full implementation uses shared generate logic.', tool, inputs };
        
        // Log API usage
        if (supabaseAdmin) {
            await supabaseAdmin.from('api_usage_logs').insert({
                api_key_id: req.apiKeyId,
                organization_id: req.orgId,
                endpoint: '/api/v1/generate',
                tool_name: tool,
                status: 'success'
            }).catch(e => console.warn('[API v1] Failed to log:', e.message));
        }

        console.log(`[API v1] Success: tool=${tool}, org=${req.orgName}`);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[API v1] Error:', error.message);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

// GET /api/v1/workflows - List user's workflows
app.get('/api/v1/workflows', validateApiKeyMiddleware, async (req, res) => {
    try {
        console.log(`[API v1] Fetching workflows for org: ${req.orgName}`);
        
        const { data, error } = await supabaseAdmin
            .from('latenode_workflows')
            .select('id, name, description, is_active, trigger_type, created_at')
            .eq('organization_id', req.orgId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ 
            success: true, 
            workflows: data || [],
            total: data?.length || 0
        });
    } catch (error) {
        console.error('[API v1] Workflows error:', error.message);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

// POST /api/v1/workflows/:id/run - Execute a workflow
app.post('/api/v1/workflows/:id/run', validateApiKeyMiddleware, async (req, res) => {
    const { id } = req.params;
    const { inputs } = req.body || {};

    try {
        console.log(`[API v1] Running workflow ${id} for org: ${req.orgName}`);
        
        // Verify workflow belongs to org
        const { data: workflow, error } = await supabaseAdmin
            .from('latenode_workflows')
            .select('*')
            .eq('id', id)
            .eq('organization_id', req.orgId)
            .single();

        if (error || !workflow) {
            return res.status(404).json({ error: 'WORKFLOW_NOT_FOUND' });
        }

        if (!workflow.is_active) {
            return res.status(400).json({ error: 'WORKFLOW_INACTIVE', message: 'Workflow is not active' });
        }

        // Execute workflow (simplified - would call actual workflow engine)
        const result = {
            message: 'Workflow execution initiated',
            workflowId: id,
            workflowName: workflow.name,
            inputs: inputs || {}
        };

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[API v1] Workflow run error:', error.message);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

// GET /api/v1/templates - List user's templates
app.get('/api/v1/templates', validateApiKeyMiddleware, async (req, res) => {
    try {
        console.log(`[API v1] Fetching templates for org: ${req.orgName}`);
        
        const { data, error } = await supabaseAdmin
            .from('templates')
            .select('id, name, description, category, input_fields, created_at')
            .eq('organization_id', req.orgId)
            .eq('is_public', false)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ 
            success: true, 
            templates: data || [],
            total: data?.length || 0
        });
    } catch (error) {
        console.error('[API v1] Templates error:', error.message);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

// POST /api/v1/templates/:id/run - Execute a template
app.post('/api/v1/templates/:id/run', validateApiKeyMiddleware, async (req, res) => {
    const { id } = req.params;
    const { inputs, options } = req.body || {};

    try {
        console.log(`[API v1] Running template ${id} for org: ${req.orgName}`);
        
        const rateLimit = checkApiRateLimit(req.apiKeyId);
        if (!rateLimit.allowed) {
            return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED' });
        }

        // Verify template exists and belongs to org
        const { data: template, error } = await supabaseAdmin
            .from('templates')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !template) {
            return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND' });
        }

        // Check if user owns template or it's public
        if (template.organization_id !== req.orgId && !template.is_public) {
            return res.status(403).json({ error: 'ACCESS_DENIED' });
        }

        // Execute template (would call actual generation logic)
        const result = {
            message: 'Template execution initiated',
            templateId: id,
            templateName: template.name,
            inputs: inputs || {}
        };

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[API v1] Template run error:', error.message);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

// GET /api/v1/brand-voices - List user's brand voices
app.get('/api/v1/brand-voices', validateApiKeyMiddleware, async (req, res) => {
    try {
        console.log(`[API v1] Fetching brand voices for org: ${req.orgName}`);
        
        const { data, error } = await supabaseAdmin
            .from('brand_voices')
            .select('id, name, description, tone_adjectives, audience, created_at')
            .eq('organization_id', req.orgId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ 
            success: true, 
            brandVoices: data || [],
            total: data?.length || 0
        });
    } catch (error) {
        console.error('[API v1] Brand voices error:', error.message);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

// GET /api/v1/models - List available AI models
app.get('/api/v1/models', validateApiKeyMiddleware, async (req, res) => {
    try {
        console.log(`[API v1] Fetching models for org: ${req.orgName}`);
        
        // Get org's available models based on subscription
        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('subscription_tier')
            .eq('id', req.orgId)
            .single();

        const tier = org?.subscription_tier?.toLowerCase() || 'starter';

        // Define available models per tier
        const allModels = [
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google', tiers: ['starter', 'professional', 'business', 'enterprise'] },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google', tiers: ['professional', 'business', 'enterprise'] },
            { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', tiers: ['business', 'enterprise'] },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', tiers: ['professional', 'business', 'enterprise'] },
            { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', tiers: ['business', 'enterprise'] },
            { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic', tiers: ['professional', 'business', 'enterprise'] },
        ];

        const availableModels = allModels
            .filter(m => m.tiers.includes(tier))
            .map(({ tiers, ...model }) => model);

        res.json({ 
            success: true, 
            models: availableModels,
            total: availableModels.length,
            tier: tier
        });
    } catch (error) {
        console.error('[API v1] Models error:', error.message);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

// ============================================
// Humanizer & SEO Endpoints
// ============================================

// POST /api/humanize - Humanize AI text (Natural Write mode)
app.post('/api/humanize', async (req, res) => {
    const userId = getUserIdFromHeader(req);
    const { text, options } = req.body || {};

    if (!userId) {
        return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    if (!text || text.length < 50) {
        return res.status(400).json({ error: 'TEXT_TOO_SHORT', message: 'Text must be at least 50 characters' });
    }

    console.log(`[Humanizer] Request from ${userId}: ${text.length} chars`);

    try {
        const { humanizeText, isHumanizerEnabled } = await import('./lib/humanizer.js');

        if (!isHumanizerEnabled()) {
            return res.status(503).json({ 
                error: 'HUMANIZER_NOT_CONFIGURED', 
                message: 'Humanizer is not configured. Set UNDETECTABLE_API_KEY in environment.' 
            });
        }

        const result = await humanizeText(text, options);

        if (result.success) {
            console.log(`[Humanizer] Success: ${result.humanized?.length} chars output`);
            res.json({
                success: true,
                humanized: result.humanized,
                original: result.original,
                aiScore: result.aiScore
            });
        } else {
            console.warn('[Humanizer] Failed:', result.error);
            res.status(400).json({ 
                success: false, 
                error: result.error,
                original: text 
            });
        }
    } catch (error) {
        console.error('[Humanizer] Error:', error.message);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

// POST /api/keywords - Get keyword suggestions
app.post('/api/keywords', async (req, res) => {
    const userId = getUserIdFromHeader(req);
    const { keyword } = req.body || {};

    if (!userId) {
        return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    if (!keyword) {
        return res.status(400).json({ error: 'MISSING_KEYWORD' });
    }

    console.log(`[Keywords] Request from ${userId}: "${keyword}"`);

    try {
        const { getKeywordSuggestions, isSerperEnabled } = await import('./lib/serper.js');

        if (!isSerperEnabled()) {
            return res.status(503).json({ 
                error: 'SERPER_NOT_CONFIGURED', 
                message: 'Keyword research is not configured. Set SERPER_API_KEY in environment.' 
            });
        }

        const result = await getKeywordSuggestions(keyword);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('[Keywords] Error:', error.message);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

// POST /api/serp-analysis - Analyze SERP for a keyword
app.post('/api/serp-analysis', async (req, res) => {
    const userId = getUserIdFromHeader(req);
    const { keyword } = req.body || {};

    if (!userId) {
        return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    if (!keyword) {
        return res.status(400).json({ error: 'MISSING_KEYWORD' });
    }

    console.log(`[SERP] Analysis request: "${keyword}"`);

    try {
        const { analyzeSERP, isSerperEnabled } = await import('./lib/serper.js');

        if (!isSerperEnabled()) {
            return res.status(503).json({ error: 'SERPER_NOT_CONFIGURED' });
        }

        const result = await analyzeSERP(keyword);
        res.json(result);
    } catch (error) {
        console.error('[SERP] Error:', error.message);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

// Export app for Vercel serverless function
export default app;

// Only listen if running directly (not imported)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {


  const PORT = parseInt(process.env.PORT || '8787', 10);
  app.listen(PORT, '0.0.0.0', () => { // Listen on all interfaces
    console.log(`[Server] WriterAI backend listening on http://localhost:${PORT}`);
  });
}
