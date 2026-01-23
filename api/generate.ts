// @ts-nocheck
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

function isString(x: any): x is string { return typeof x === 'string'; }

function buildPrompt(tool, inputs, outputCount, tone) {
  switch (tool) {
    case 'email_subject':
      return `Generate ${outputCount} email subject lines for: ${inputs.topic}\nTarget audience: ${inputs.audience}\nGoal: Maximize ${inputs.goal}${tone ? `\nTone: ${tone}` : ''}\n\nFor each subject line, provide strictly these fields:\n- text\n- openRate (percent string like '45%')\n- trigger (e.g., Curiosity)\n- charCount (integer)\n\nReturn as a JSON array.`;
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
        seoKeywords: Array.isArray(item?.seoKeywords) ? item?.seoKeywords.map((t) => String(t)) : [],
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
      return { roleSummary: String(data ?? ''), responsibilities: [], requiredQualifications: [], niceToHave: [], salaryRange: '', culture: '', eeoStatement: '', complianceNotes: [] };
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
        return { text: String(data?.text ?? ''), atsScore: String(data?.atsScore ?? ''), openingHook: String(data?.openingHook ?? ''), closing: String(data?.closing ?? '') };
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
          items: Array.isArray(data?.items) ? data.items.map((it) => ({ question: String(it?.question ?? ''), answer: String(it?.answer ?? '') })) : [],
          seoScore: String(data?.seoScore ?? ''),
          schemaMarkup: String(data?.schemaMarkup ?? ''),
        };
      }
      return { items: [], seoScore: '', schemaMarkup: '' };
    }
    case 'script': {
      if (data && typeof data === 'object') {
        return {
          segments: Array.isArray(data?.segments) ? data.segments.map((s) => ({ time: String(s?.time ?? ''), line: String(s?.line ?? '') })) : [],
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
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Unreachable');
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  if (!genAI) {
    return res.status(500).json({ error: 'MISSING_GEMINI_API_KEY', message: 'Backend not configured with GEMINI_API_KEY' });
  }

  const { tool, inputs, outputCount = 3, tone } = (req.body || {});
  const userId = isString(req.headers['x-user-id'] || req.headers['X-User-Id']) ? String(req.headers['x-user-id'] || req.headers['X-User-Id']) : null;

  if (!tool || !inputs || typeof inputs !== 'object') {
    return res.status(400).json({ error: 'INVALID_REQUEST', message: 'tool and inputs required' });
  }

  // Optional credits enforcement
  const TOOL_CREDIT_COST: Record<string, number> = {
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
  let userCreditsBalance: number | null = null;

  if (supabaseAdmin && userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('credits_balance')
        .eq('id', userId)
        .single();
      if (error) throw error;
      if (data && typeof data.credits_balance === 'number') {
        userCreditsBalance = data.credits_balance;
        if (data.credits_balance < creditsCharged) {
          return res.status(402).json({ error: 'INSUFFICIENT_CREDITS', message: 'Not enough credits to generate for this tool', debug: { required: creditsCharged, balance: data.credits_balance } });
        }
      }
    } catch (e) {
      // skip enforcement if columns missing
    }
  }

  try {
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = buildPrompt(tool, inputs, outputCount, tone);
    const finalPrompt = `${prompt}\n\nReturn strictly valid JSON. Do not include code fences.`;

    const { text, attempts } = await generateWithRetry(model, finalPrompt);

    let parsedJson: any = null;
    try { parsedJson = JSON.parse(text); } catch (e) {
      const match = text.match(/\[.*\]|\{.*\}/s);
      if (match) {
        try { parsedJson = JSON.parse(match[0]); } catch {}
      }
    }

    if (!parsedJson) {
      return res.status(502).json({ error: 'BAD_MODEL_OUTPUT', message: 'Model did not return valid JSON', debug: { rawPreview: text.slice(0, 1000) } });
    }

    const formatted = formatResults(tool, parsedJson);

    if (supabaseAdmin && userId && userCreditsBalance !== null) {
      try {
        const newBalance = Math.max(0, Number(userCreditsBalance) - Number(creditsCharged));
        await supabaseAdmin
          .from('users')
          .update({ credits_balance: newBalance })
          .eq('id', userId);
      } catch {}
    }

    if (supabaseAdmin && userId) {
      supabaseAdmin
        .from('tool_usage')
        .insert({ user_id: userId, tool_name: tool, input_tokens_used: null, output_tokens_used: null, timestamp: new Date().toISOString() })
        .then(() => {})
        .catch(() => {});
    }

    return res.json({ results: formatted, debug: { tool, model: modelName, creditsCharged, attemptsUsed: attempts } });
  } catch (err) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Generation failed', debug: { message: err?.message } });
  }
}
