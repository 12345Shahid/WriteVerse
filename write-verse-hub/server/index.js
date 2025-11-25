import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';
import { recordUsage } from './meter.js';

import { ingestDocument, searchKnowledge } from './knowledge-base.js';
import { chatWithAgent } from './agents.js';

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Initialize Gemini and Supabase admin client
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

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

  const { tool, inputs, outputCount = 3, tone, brandVoiceId } = parsed.data;

  if (isUnsafeContent(tool, inputs)) {
    const formatted = buildSafeResults(tool, inputs);
    const t1 = Date.now();
    return res.json({
      results: formatted,
      debug: { tool, durationMs: t1 - t0, model: 'safety-filter', blocked: true },
    });
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
  const creditsCharged = TOOL_CREDIT_COST[tool] ?? 1;

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

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: 'v1' });

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
          provider: 'google',
          action: 'generate',
          units: estimatedTokens,
          credits: creditsCharged,
          metadata: { model: modelName, attempts }
        });
        console.log(`[Credits] Deducted ${creditsCharged} from org ${orgId}`);
      } catch (e) {
        console.warn('[Credits] Deduction failed', e?.message || e);
      }
    }

    const t1 = Date.now();
    const formatted = formatResults(tool, parsedJson);

    return res.json({
      results: formatted,
      debug: { tool, durationMs: t1 - t0, model: modelName, creditsCharged, attemptsUsed: attempts },
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
    res.json(result);

  } catch (e) {
    console.error("Workflow Error", e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/agents/chat', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];
  const { agentId, message, sessionId, attachments } = req.body;

  if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });
  if (!agentId || (!message && (!attachments || attachments.length === 0))) return res.status(400).json({ error: 'Missing agentId or content' });

  try {
    const result = await chatWithAgent(userId, orgId, agentId, message || '', sessionId, attachments || []);
    res.json(result);
  } catch (e) {
    console.error("Agent Chat Error", e);
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
  const creditsPerUsd = 100;
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
    console.log('[Checkout][CONFIRM] Looking up credits_transactions', { userId, sessionId });
    const { data: tx, error: txError } = await supabaseAdmin
      .from('credits_transactions')
      .select('id, user_id, amount_cents, credits_added, status, stripe_session_id')
      .eq('user_id', userId)
      .eq('stripe_session_id', sessionId)
      .single();
    if (txError || !tx) {
      console.error('[Checkout][CONFIRM] credits_transactions lookup failed', txError);
      return res.status(404).json({ error: 'TX_NOT_FOUND', message: 'No matching credits transaction for this session' });
    }

    if (tx.status === 'succeeded') {
      console.log('[Checkout][CONFIRM] Transaction already succeeded, returning idempotent success', {
        txId: tx.id,
      });
      return res.status(200).json({ ok: true, alreadyConfirmed: true });
    }

    console.log('[Checkout][CONFIRM] Retrieving Stripe session', { sessionId });
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const paid = session.payment_status === 'paid' || session.status === 'complete';
    if (!paid) {
      console.warn('[Checkout][CONFIRM] Session not paid', {
        sessionId,
        payment_status: session.payment_status,
        status: session.status,
      });
      return res.status(400).json({
        error: 'SESSION_NOT_PAID',
        message: 'Checkout session is not paid yet',
      });
    }

    const amountTotal = session.amount_total || 0;
    if (amountTotal && amountTotal !== tx.amount_cents) {
      console.warn('[Checkout][CONFIRM] Amount mismatch', {
        txAmount: tx.amount_cents,
        sessionAmount: amountTotal,
      });
    }

    console.log('[Checkout][CONFIRM] Fetching user credits', { userId });
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('credits_balance, credits_lifetime')
      .eq('id', userId)
      .single();
    if (userError || !user) {
      console.error('[Checkout][CONFIRM] Failed to fetch user row', userError);
      return res.status(500).json({ error: 'USER_FETCH_FAILED', message: String(userError?.message || userError) });
    }

    const newBalance = (user.credits_balance ?? 0) + tx.credits_added;
    const newLifetime = (user.credits_lifetime ?? 0) + tx.credits_added;

    console.log('[Checkout][CONFIRM] Updating user credits', {
      oldBalance: user.credits_balance,
      newBalance,
      creditsAdded: tx.credits_added,
    });
    const { error: updateUserError } = await supabaseAdmin
      .from('users')
      .update({ credits_balance: newBalance, credits_lifetime: newLifetime })
      .eq('id', userId);
    if (updateUserError) {
      console.error('[Checkout][CONFIRM] Failed to update user credits', updateUserError);
      return res.status(500).json({ error: 'USER_UPDATE_FAILED', message: String(updateUserError?.message || updateUserError) });
    }

    console.log('[Checkout][CONFIRM] Marking transaction as succeeded', { txId: tx.id });
    const { error: updateTxError } = await supabaseAdmin
      .from('credits_transactions')
      .update({ status: 'succeeded' })
      .eq('id', tx.id);
    if (updateTxError) {
      console.error('[Checkout][CONFIRM] Failed to update transaction status', updateTxError);
    }

    return res.status(200).json({
      ok: true,
      credits_added: tx.credits_added,
      new_balance: newBalance,
      new_lifetime: newLifetime,
    });
  } catch (e) {
    console.error('[Checkout][CONFIRM] Error', e);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(e?.message || e) });
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
        status: status || 'active',
        created_by: userId
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

app.listen(PORT, () => {
  console.log(`[Server] WriterAI backend listening on http://localhost:${PORT}`);
});
