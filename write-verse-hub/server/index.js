import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';

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
  ]),
  inputs: z.record(z.any()),
  outputCount: z.number().min(1).max(10).optional(),
  tone: z.string().optional(),
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

async function generateWithRetry(model, prompt, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await model.generateContent(prompt);
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

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'WriterAI backend',
    geminiReady: !!genAI,
    supabaseReady: !!supabaseAdmin,
    time: new Date().toISOString(),
  });
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

  const { tool, inputs, outputCount = 3, tone } = parsed.data;

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
  };
  const creditsCharged = TOOL_CREDIT_COST[tool] ?? 1;
  let userCreditsBalance = null;
  if (supabaseAdmin && req.headers['x-user-id']) {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('credits_balance')
        .eq('id', req.headers['x-user-id'])
        .single();
      if (error) throw error;
      if (data && typeof data.credits_balance === 'number') {
        userCreditsBalance = data.credits_balance;
        if (data.credits_balance < creditsCharged) {
          return res.status(402).json({
            error: 'INSUFFICIENT_CREDITS',
            message: 'Not enough credits to generate for this tool',
            debug: { required: creditsCharged, balance: data.credits_balance },
          });
        }
      }
    } catch (e) {
      console.warn('[Credits] Enforcement skipped', e?.message || e);
    }
  }

  try {
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = buildPrompt(tool, inputs, outputCount, tone);
    const finalPrompt = `${prompt}\n\nReturn strictly valid JSON. Do not include code fences.`;

    const { text, attempts } = await generateWithRetry(model, finalPrompt);

    let parsedJson = null;
    try {
      parsedJson = JSON.parse(text);
    } catch (e) {
      const match = text.match(/\[.*\]|\{.*\}/s);
      if (match) {
        try { parsedJson = JSON.parse(match[0]); } catch {}
      }
    }

    if (!parsedJson) {
      console.error('[Generate] JSON parse failed', { preview: text.slice(0, 300) });
      return res.status(502).json({
        error: 'BAD_MODEL_OUTPUT',
        message: 'Model did not return valid JSON',
        debug: { rawPreview: text.slice(0, 1000) },
      });
    }

    const formatted = formatResults(tool, parsedJson);

    // Deduct credits if we previously fetched a balance
    if (supabaseAdmin && req.headers['x-user-id'] && userCreditsBalance !== null) {
      try {
        const newBalance = Math.max(0, Number(userCreditsBalance) - Number(creditsCharged));
        await supabaseAdmin
          .from('users')
          .update({ credits_balance: newBalance })
          .eq('id', req.headers['x-user-id']);
      } catch (e) {
        console.warn('[Credits] Deduction failed', e?.message || e);
      }
    }

    if (supabaseAdmin && req.headers['x-user-id']) {
      supabaseAdmin
        .from('tool_usage')
        .insert({
          user_id: req.headers['x-user-id'],
          tool_name: tool,
          input_tokens_used: null,
          output_tokens_used: null,
          timestamp: new Date().toISOString(),
        })
        .then(() => console.log('[Usage] Logged'))
        .catch((err) => console.error('[Usage] Log failed', err));
    }

    const t1 = Date.now();
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
    default:
      return `Inputs: ${JSON.stringify(inputs)}. Return concise JSON.`;
  }
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
      return { summary: String(data ?? ''), readability: '', keyPoints: [], keywords: [], readingTime: '', timeSaved: '' };
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
          items: Array.isArray(data?.items) ? data.items.map((it) => ({
            question: String(it?.question ?? ''),
            answer: String(it?.answer ?? ''),
          })) : [],
          seoScore: String(data?.seoScore ?? ''),
          schemaMarkup: String(data?.schemaMarkup ?? ''),
        };
      }
      return { items: [], seoScore: '', schemaMarkup: '' };
    }
    case 'script': {
      if (data && typeof data === 'object') {
        return {
          segments: Array.isArray(data?.segments) ? data.segments.map((s) => ({
            time: String(s?.time ?? ''),
            line: String(s?.line ?? ''),
          })) : [],
          pacingWpm: Number(data?.pacingWpm ?? 0),
          wordCount: Number(data?.wordCount ?? 0),
          readTime: String(data?.readTime ?? ''),
        };
      }
      return { segments: [], pacingWpm: 0, wordCount: 0, readTime: '' };
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
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });
  const parsed = SaveResultsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_REQUEST', details: parsed.error.flatten() });
  }
  try {
    const payload = { ...parsed.data, user_id: userId };
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

app.listen(PORT, () => {
  console.log(`[Server] WriterAI backend listening on http://localhost:${PORT}`);
});
