import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// OpenRouter Client (compatible with Google Generative AI interface)
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

class OpenRouterModel {
  private apiKey: string;
  private modelId: string;

  constructor(apiKey: string, modelId: string) {
    this.apiKey = apiKey;
    this.modelId = modelId;
  }

  async generateContent(request: string | { contents?: any[]; generationConfig?: any }) {
    let messages: { role: string; content: string }[] = [];

    if (typeof request === 'string') {
      messages.push({ role: 'user', content: request });
    } else if (request.contents) {
      messages = request.contents.map((c: any) => ({
        role: c.role === 'model' ? 'assistant' : c.role,
        content: c.parts.map((p: any) => p.text).join(''),
      }));
    }

    const config = typeof request === 'object' ? request.generationConfig || {} : {};

    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://writerai.app',
        'X-Title': 'WriterAI',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.modelId,
        messages: messages,
        max_tokens: config.maxOutputTokens || 16384,
        temperature: config.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No content generated');
    }

    const content = data.choices[0].message.content;
    const finishReason = data.choices[0].finish_reason;
    
    console.log('[OpenRouter] Response received, finish_reason:', finishReason, 'content length:', content?.length);
    
    // Warn if response was truncated
    if (finishReason === 'length') {
      console.warn('[OpenRouter] Response was truncated due to max_tokens limit');
    }

    return {
      response: {
        text: () => content,
      },
    };
  }
}

function getOpenRouterModel(apiKey: string, modelId: string) {
  return new OpenRouterModel(apiKey, modelId);
}

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

let supabaseAdminClient: SupabaseClient | null = null;

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    console.warn('[API][generate] Missing SUPABASE_URL or SERVICE_ROLE key');
    return null;
  }
  if (!supabaseAdminClient) {
    console.log('[API][generate] Creating Supabase admin client');
    supabaseAdminClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseAdminClient;
}

function getUserIdFromHeader(req: any): string | null {
  try {
    const v = (req.headers?.['x-user-id'] || req.headers?.['X-User-Id'] || req.headers?.['X-USER-ID']) as
      | string
      | undefined;
    const id = (v && String(v)) || null;
    if (!id) {
      console.debug('[API][generate] No X-User-Id header present');
    }
    return id;
  } catch (e: any) {
    console.error('[API][generate] getUserIdFromHeader error', e);
    return null;
  }
}

function getOrgIdFromHeader(req: any): string | null {
  try {
    const v = (req.headers?.['x-organization-id'] || req.headers?.['X-Organization-Id']) as string | undefined;
    return (v && String(v)) || null;
  } catch (e: any) {
    return null;
  }
}

const SAFETY_MESSAGE =
  'WriterAI could not generate content for this request. Please try again with different input or try again later.';

function collectTextFromInputs(value: any, bucket: string[]) {
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

function isUnsafeContent(tool: string, inputs: any) {
  // Custom keyword-based safety filter disabled: allow all topics.
  // Any remaining content limitations come from the underlying model/provider.
  return false;
}

function buildSafeResults(tool: string, inputs: any) {
  switch (tool) {
    case 'email_subject':
      return [
        {
          text: SAFETY_MESSAGE,
          openRate: 'N/A',
          trigger: 'Safety Policy',
          charCount: SAFETY_MESSAGE.length,
        },
      ];
    case 'resume':
      return [
        {
          text: SAFETY_MESSAGE,
          actionVerb: 'N/A',
          score: 'N/A',
        },
      ];
    case 'cold_email':
      return [
        {
          text: SAFETY_MESSAGE,
          hook: 'Safety Policy',
          tips: [
            'Focus your outreach on legal, ethical products or services.',
            'Avoid topics involving alcohol, weapons, illegal drugs, or explicit adult material.',
            'Reframe your message around positive, constructive value for your audience.',
          ],
          followUps: [],
        },
      ];
    case 'product_description':
      return [
        {
          text: SAFETY_MESSAGE,
          tone: 'Neutral',
          seoKeywords: [],
          metaDescription:
            'This topic is not supported. Please choose a different, positive product or service.',
          cta: 'Please choose a different, positive topic.',
          bullets: [],
        },
      ];
    case 'job_description':
      return {
        roleSummary: SAFETY_MESSAGE,
        responsibilities: [],
        requiredQualifications: [],
        niceToHave: [],
        salaryRange: '',
        culture: '',
        eeoStatement:
          'We encourage safe, inclusive, and ethical work environments. Content involving alcohol, weapons, illegal drugs, or explicit adult material is not supported.',
        complianceNotes: [
          'Avoid roles or descriptions centered on harmful or unethical activities.',
          'Keep job descriptions aligned with legal and ethical standards.',
        ],
      };
    case 'linkedin':
      return [
        {
          text: SAFETY_MESSAGE,
          engagementScore: 'N/A',
          hashtags: '#EthicalContent',
          emojiSuggestions: [],
        },
      ];
    case 'social_ad':
      return [
        {
          text: SAFETY_MESSAGE,
          platform: String(inputs?.platform || 'generic'),
          predictedCtr: 'N/A',
          trigger: 'Safety Policy',
          charCount: SAFETY_MESSAGE.length,
        },
      ];
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
        closing:
          'Please try again with a different role, company, or subject that aligns with ethical guidelines.',
      };
    case 'twitter_thread':
      return {
        tweets: [`1/ ${SAFETY_MESSAGE}`],
        engagementPrediction: 'N/A',
        hashtags: '#EthicalContent',
      };
    case 'faq':
      return {
        items: [
          {
            question:
              'Can I generate content about alcohol, weapons, illegal drugs, or explicit adult material?',
            answer: SAFETY_MESSAGE,
          },
        ],
        seoScore: 'N/A',
        schemaMarkup: '',
      };
    case 'script':
      return {
        segments: [
          {
            time: '00:00',
            line: SAFETY_MESSAGE,
          },
        ],
        pacingWpm: 0,
        wordCount: SAFETY_MESSAGE.split(/\s+/).filter(Boolean).length,
        readTime: 'N/A',
      };
    case 'blog_helper':
    case 'copy_helper':
    case 'social_helper':
    case 'email_writer':
    case 'rewrite_helper':
      return [
        {
          text: SAFETY_MESSAGE,
        },
      ];
    case 'blog_post':
      return {
        title: 'Content not available',
        slug_suggestion: '',
        outline: [],
        body: SAFETY_MESSAGE,
        meta_description: SAFETY_MESSAGE,
      };
    case 'article_from_outline':
      return {
        title: 'Content not available',
        outline: [],
        body: SAFETY_MESSAGE,
      };
    case 'seo_blog_optimizer':
      return {
        optimized_title: 'Content not available',
        optimized_meta_description: SAFETY_MESSAGE,
        optimized_body: SAFETY_MESSAGE,
        suggested_headings: [],
        keyword_usage_notes: [SAFETY_MESSAGE],
        improvements_summary: SAFETY_MESSAGE,
      };
    case 'case_study_writer':
      return {
        headline: 'Content not available',
        summary: SAFETY_MESSAGE,
        background: '',
        challenge: '',
        solution: '',
        results: SAFETY_MESSAGE,
        quote: '',
      };
    case 'landing_page_writer':
      return {
        hero_headline: 'Content not available',
        hero_subheadline: SAFETY_MESSAGE,
        hero_cta: '',
        sections: [],
        faq_items: [],
      };
    case 'report_writer':
      return {
        title: 'Content not available',
        abstract: SAFETY_MESSAGE,
        sections: [],
      };
    default:
      return SAFETY_MESSAGE;
  }
}

function buildFallbackResults(tool: string, inputs: any, outputCount: number) {
  if (tool === 'email_subject') {
    const topic = String(inputs?.topic || 'your email campaign');
    const audience = String(inputs?.audience || 'your audience');
    const goal = String(inputs?.goal || 'open_rate');
    const goalLabel =
      goal === 'click_rate' ? 'clicks' : goal === 'conversions' ? 'conversions' : 'opens';
    const templates = [
      `Boost your ${goalLabel} for ${topic}`,
      `Do not miss this ${topic} update`,
      `${topic}: a must-see for ${audience}`,
      `Fresh ideas for ${topic}`,
      `${topic}: simple tips for ${audience}`,
      `Quick win: improve ${goalLabel} with ${topic}`,
      `${topic} – what ${audience} should know`,
      `Make ${topic} stand out in the inbox`,
      `Simple subject lines to promote ${topic}`,
      `A new angle on ${topic} for ${audience}`,
    ];
    const count = Math.max(1, Math.min(outputCount || 10, 10));
    const arr: any[] = [];
    for (let i = 0; i < count; i++) {
      const text = templates[i % templates.length];
      arr.push({
        text,
        openRate: '',
        trigger: 'General',
        charCount: text.length,
      });
    }
    return arr;
  }
  return buildSafeResults(tool, inputs);
}

function buildPrompt(tool: string, inputs: any, outputCount: number, tone?: string | null) {
  switch (tool) {
    case 'email_subject':
      return `Generate ${outputCount} email subject lines for: ${inputs.topic}\nTarget audience: ${inputs.audience}\nGoal: Maximize ${inputs.goal}${
        tone ? `\nTone: ${tone}` : ''
      }\n\nFor each subject line, provide strictly these fields:\n- text\n- openRate (percent string like '45%')\n- trigger (e.g., Curiosity)\n- charCount (integer)\n\nReturn as a JSON array.`;
    case 'resume':
      return `Generate ${Math.max(1, outputCount)} powerful resume bullet points based on:\nJob Title: ${
        inputs.jobTitle
      }\nAchievements: ${inputs.achievements}\nMetrics: ${inputs.metrics || 'N/A'}${
        tone ? `\nTone: ${tone}` : ''
      }\n\nReturn a JSON array of objects with fields:\n- text (the bullet text)\n- actionVerb (the leading action verb)\n- score (ATS fit score like '92/100').`;
    case 'cold_email':
      return `Generate 3 personalized cold email variations for:\nProspect: ${inputs.prospectName}\nCompany: ${
        inputs.company
      }\nValue Proposition: ${inputs.valueProp || 'N/A'}\nPain Point: ${inputs.painPoint || 'N/A'}${
        tone ? `\nTone: ${tone}` : ''
      }\n\nProvide variations with hooks: Curiosity, Pain-Point, Value-First.\n\nFor each variation, return strictly these fields:\n- text\n- hook (Curiosity Hook | Pain-Point Hook | Value-First Hook)\n- tips (array of 3 short personalization tips)\n- followUps (array of 2 short follow-up templates)\n\nReturn a JSON array.`;
    case 'product_description':
      return `Generate 3 product descriptions for:\nProduct: ${inputs.productName}\nFeatures: ${
        inputs.features
      }\nTarget Market: ${inputs.targetMarket}\nPrice Point: ${inputs.pricePoint}${
        tone ? `\nTone Preference: ${tone}` : ''
      }\nBullet Mode: ${inputs.bulletMode ? 'ON' : 'OFF'}\n\nReturn a JSON array of objects with fields:\n- text\n- tone (Casual & Friendly | Professional | Luxury Premium)\n- seoKeywords (array of ~5 SEO keywords)\n- metaDescription (concise 140-160 chars)\n- cta (short call-to-action)\n${
        inputs.bulletMode
          ? '- bullets (array of 5 concise bullet points for e-commerce listing)\n'
          : ''
      }`;
    case 'job_description':
      return `Generate a complete job description for:\nRole Title: ${inputs.roleTitle}\nResponsibilities: ${
        inputs.responsibilities
      }\nCulture: ${inputs.culture || 'N/A'}\nExperience Level: ${inputs.experienceLevel}${
        tone ? `\nTone: ${tone}` : ''
      }\n\nReturn a single JSON object with strictly these fields:\n- roleSummary (string)\n- responsibilities (array of 5-8 bullet strings)\n- requiredQualifications (array of bullet strings)\n- niceToHave (array of bullet strings)\n- salaryRange (string)\n- culture (string)\n- eeoStatement (string)\n- complianceNotes (array of 3 short notes about inclusive/ADA/EEOC-friendly language)`;
    case 'linkedin':
      return `Generate 3 LinkedIn post variations for:\nTopic: ${inputs.topic}\nIndustry: ${
        inputs.industry
      }\nTone: ${inputs.tone}${tone ? `\nTone Override: ${tone}` : ''}\n\nEach variation should include a strong hook, body, and CTA, and suggest hashtags.\nReturn a JSON array of objects with fields:\n- text\n- engagementScore (e.g., 'High', 'Very High', 'Medium-High')\n- hashtags (e.g., '#CareerAdvice #Tech')\n- emojiSuggestions (array of 3-6 relevant emojis).`;
    case 'social_ad':
      return `Generate ${Math.max(1, outputCount)} short social media ad copies for:\nProduct/Service: ${
        inputs.productName
      }\nTarget Audience: ${inputs.audience}\nPlatform: ${inputs.platform}\nCampaign Goal: ${
        inputs.goal
      }${tone ? `\nTone: ${tone}` : ''}\n\nReturn a JSON array of objects with fields:\n- text\n- platform\n- predictedCtr (percent string like '3.2%')\n- trigger (FOMO | Social Proof | Curiosity | Urgency)\n- charCount (integer)`;
    case 'summarizer':
      return `Condense the following text preserving key points.\nTone: ${inputs.tone}\nTarget length: ${
        inputs.length
      }\n\nText:\n${inputs.text}\n\nReturn a single JSON object with fields:\n- summary (string)\n- readability (e.g., '75/100' or 'Grade 8')\n- keyPoints (array of 3-6 short bullets)\n- keywords (array of ~5 SEO keywords)\n- readingTime (string like '35 sec')\n- timeSaved (string like '1m 25s saved')`;
    case 'cover_letter':
      return `Write a professional cover letter (250-300 words).\nJob Title: ${inputs.jobTitle}\nCompany: ${
        inputs.company
      }\nKey Achievement: ${inputs.achievement}\nHiring Manager: ${inputs.hiringManager || 'N/A'}${
        tone ? `\nTone: ${tone}` : ''
      }\n\nReturn a single JSON object with fields:\n- text\n- atsScore (like '92/100')\n- openingHook (string)\n- closing (string)`;
    case 'twitter_thread':
      return `Compose a Twitter/X thread.\nTopic: ${inputs.topic}\nAudience: ${inputs.audience}\nTone: ${
        inputs.tone
      }\nLength: ${inputs.length} tweets\n\nReturn a single JSON object with fields:\n- tweets (array of ${
        inputs.length || 5
      } strings, numbered appropriately)\n- engagementPrediction (string like 'Est. 450 likes, 120 reposts')\n- hashtags (string like '#growth #startups')`;
    case 'faq':
      return `Generate an FAQ section.\nProduct/Service: ${inputs.productName}\nPain Points: ${
        inputs.painPoints
      }\nFeatures: ${inputs.features}\nFAQ Count: ${inputs.count || 10}${
        tone ? `\nTone: ${tone}` : ''
      }\n\nReturn a single JSON object with fields:\n- items (array of objects with {question, answer})\n- seoScore (like '8.5/10')\n- schemaMarkup (JSON-LD string for FAQPage)`;
    case 'script':
      return `Write a script/voiceover.\nTopic: ${inputs.topic}\nDuration: ${inputs.duration}\nTone: ${
        inputs.tone
      }\nTarget Viewer: ${
        inputs.viewer
      }\n\nInclude pacing and clear [Action]/[Pause] markers with timestamps.\nReturn a single JSON object with fields:\n- segments (array of objects with {time, line})\n- pacingWpm (number)\n- wordCount (number)\n- readTime (string)`;
    case 'blog_helper':
      return `You are an expert blog and article writing assistant.\nMode: ${
        inputs.mode
      } (one of: intro, outline, conclusion, section, paragraph, paragraph_expand, sentence_expand, article_expand, article_rewrite).\nTopic: ${
        inputs.topic
      }\nTarget audience: ${inputs.audience || 'general readers'}\nKeywords: ${
        inputs.keywords || 'none'
      }\nTone: ${inputs.tone || tone || 'neutral'}\nSource text (if provided for expand/rewrite modes): ${
        inputs.sourceText || 'N/A'
      }\n\nGenerate ${
        outputCount
      } variants appropriate for the selected mode.\nReturn a JSON array of objects with the following field:\n- text (the generated content as a string)`;
    case 'copy_helper':
      return `You are an expert direct-response copywriter.\nMode: ${
        inputs.mode
      } (one of: aida, pas, pbs, sales_blurb, tagline).\nProduct or offer: ${
        inputs.product
      }\nAudience: ${inputs.audience || 'general audience'}\nOffer or main benefit: ${
        inputs.offer || 'N/A'
      }\nPain points to address: ${
        inputs.painPoints || 'N/A'
      }\nTone: ${inputs.tone || tone || 'neutral'}\n\nGenerate ${
        Math.max(1, outputCount)
      } short copy variations tailored to this mode.\nReturn a JSON array of objects with:\n- text (the copy as a single string)`;
    case 'social_helper':
      return `You are a social media copywriter.\nMode: ${
        inputs.mode
      } (one of: post, caption, hook, hashtag_block, bio).\nPlatform: ${
        inputs.platform
      }\nTopic: ${
        inputs.topic
      }\nAudience: ${inputs.audience || 'general followers'}\nCTA or goal: ${
        inputs.cta || 'N/A'
      }\nTone: ${inputs.tone || tone || 'neutral'}\n\nGenerate ${
        Math.max(1, outputCount)
      } variations suitable for this platform and mode.\n\nFormatting rules (important):\n- Use plain text only.\n- Do not use markdown syntax (no *, **, headings, bullet markers, or code fences).\n- Do not use emojis or emoji characters.\n- You may use normal sentences and line breaks.\n\nReturn a JSON array of objects with:\n- text (the post, caption, hook, hashtag block, or bio as a single string)`;
    case 'email_writer':
      return `You are a helpful professional email writer.\nEmail type: ${
        inputs.emailType
      } (one of: follow_up, outreach, newsletter, professional, thank_you).\nRecipient: ${
        inputs.recipient || 'N/A'
      }\nSubject or topic: ${
        inputs.subject || inputs.topic || 'N/A'
      }\nContext / key details: ${
        inputs.context || 'N/A'
      }\nTone: ${inputs.tone || tone || 'professional'}\n\nWrite ${
        Math.max(1, outputCount)
      } concise email drafts (body only; you may include a clear subject line at the top if helpful).\nReturn a JSON array of objects with:\n- text (the full email content as a single string)`;
    case 'rewrite_helper':
      return `You are an expert editor and rewriting assistant.\nMode: ${
        inputs.mode
      } (one of: rewrite, improve, simplify, formal, casual, shorten, expand, tone_change).\nTone: ${
        inputs.tone || tone || 'neutral'
      }\nTarget length: ${
        inputs.length || 'same'
      }\nExtra instructions: ${
        inputs.instructions || 'N/A'
      }\n\nOriginal text:\n${
        inputs.sourceText
      }\n\nRewrite the text according to the mode and instructions, generating ${
        Math.max(1, outputCount)
      } distinct variations.\nReturn a JSON array of objects with:\n- text (the rewritten text as a single string)`;
    case 'blog_post':
      // Support custom word count from inputs
      const targetWordCount = inputs.wordCount || (inputs.length === 'long' ? 3500 : inputs.length === 'short' ? 1000 : 2000);
      const isLong = targetWordCount >= 3000;
      const minWords = Math.floor(targetWordCount * 0.9);
      const maxWords = Math.floor(targetWordCount * 1.1);
      
      const role = isLong
        ? 'You are an expert long-form blog writer. You write comprehensive, deep-dive articles.'
        : 'You are a professional blog writer who writes detailed, engaging content.';

      return `${role}

TOPIC: ${inputs.topic}
TARGET AUDIENCE: ${inputs.audience || 'general readers'}
GOAL: ${inputs.goal || 'educate and engage'}
PRIMARY KEYWORD: ${inputs.primaryKeyword || 'N/A'}
SECONDARY KEYWORDS: ${inputs.secondaryKeywords || 'N/A'}
TONE: ${inputs.tone || 'professional'}

=== SUBSTANCE & DEPTH REQUIREMENT ===
- The article MUST be comprehensive and provide value.
- Do NOT repeat yourself to reach word count.
- Instead, go deeper into sub-topics, provide examples, and actionable advice.

=== STRICT WORD COUNT REQUIREMENT ===
Your article MUST be between ${minWords} and ${maxWords} words.
Target: ${targetWordCount} words. 
This is NON-NEGOTIABLE. Count your words before responding.

=== OUTPUT FORMAT (JSON) ===
Return ONLY a valid JSON object with exactly these 5 fields:

{
  "title": "Compelling Article Title Here",
  "slug_suggestion": "url-friendly-slug-here",
  "outline": ["Introduction", "Section 1", "Section 2", "...""],
  "body": "FULL ARTICLE TEXT GOES HERE - plain text with headings, NO JSON inside",
  "meta_description": "SEO meta description 150-160 characters"
}

=== CRITICAL RULES FOR THE BODY FIELD ===
1. The body field must contain ONLY the article text.
2. DO NOT put JSON syntax inside the body (no quotes, braces, colons, "title":, etc.)
3. Start the body with the Introduction paragraph directly.
4. Use plain text headings like "Introduction" or "What is AI?" on their own lines.
5. Write complete paragraphs, not JSON key-value pairs.
6. NO HTML tags in the body (<h1>, <p>, etc.) - ONLY plain text with spacing.
7. NO markdown (no #, ##, *, **) - use simple spacing for hierarchy.

EXAMPLE of CORRECT body format:
"body": "Introduction

Artificial intelligence is transforming how we work and live. In this article, we explore the fundamentals of AI and its impact on society.

What is Artificial Intelligence?

Artificial intelligence refers to computer systems designed to perform tasks that typically require human intelligence..."

Write the full article now. Remember: ${minWords}-${maxWords} words.`;
    case 'article_from_outline':
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
    case 'seo_blog_optimizer':
      return `You are an SEO expert and editor. Improve the following blog article for SEO and readability.\nPrimary keyword: ${
        inputs.primaryKeyword
      }\nSecondary keywords: ${
        inputs.secondaryKeywords || 'N/A'
      }\nGoal: ${
        inputs.goal || 'improve organic traffic and CTR'
      }\nTone: ${
        inputs.tone || tone || 'neutral'
      }\n\nOriginal article:\n${
        inputs.originalText
      }\n\nFormatting rules (important):\n- Use plain text only.\n- Do not use markdown syntax (no *, **, bullet markers, or code fences).\n- Do not include markdown headings like #, ##, or code fences.\n- You may still use numbered lists like '1.' or '2.' when helpful.\n\nReturn a single JSON object with fields:\n- optimized_title\n- optimized_meta_description\n- optimized_body\n- suggested_headings (array of strings)\n- keyword_usage_notes (array of short bullet strings)\n- improvements_summary (short paragraph)`;
    case 'case_study_writer':
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
      }\nTone: ${
        inputs.tone || tone || 'professional'
      }\n\nWrite a detailed narrative case study with clear section transitions.\n\nFormatting rules (important):\n- Use plain text only.\n- Do not use markdown syntax (no *, **, bullet markers, or code fences).\n- Do not include markdown headings like #, ##, or code fences.\n- You may still use numbered lists like '1.' or '2.' when listing results.\n\nReturn a single JSON object with fields:\n- headline\n- summary\n- background\n- challenge\n- solution\n- results\n- quote`;
    case 'landing_page_writer':
      return `You are a conversion-focused landing page copywriter.\nProduct or offer: ${
        inputs.product
      }\nTarget audience: ${
        inputs.audience
      }\nMain benefit / promise: ${
        inputs.benefit
      }\nKey features: ${
        inputs.features
      }\nOffer and pricing: ${
        inputs.offer || 'N/A'
      }\nTone: ${
        inputs.tone || tone || 'persuasive'
      }\n\nWrite a full landing page including hero, social proof, benefits, and a closing section.\n\nFormatting rules (important):\n- Use plain text only.\n- Do not use markdown syntax (no *, **, bullet markers, or code fences).\n- Do not include markdown headings like #, ##, or code fences.\n- You may still use numbered lists like '1.' or '2.' when helpful.\n\nReturn a single JSON object with fields:\n- hero_headline\n- hero_subheadline\n- hero_cta\n- sections (array of { title, body })\n- faq_items (array of { question, answer })`;
    case 'report_writer':
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
    default:
      return `Inputs: ${JSON.stringify(inputs)}. Return concise JSON.`;
  }
}

function stripBasicMarkdown(text: string): string {
  if (!text) return '';
  return text
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bullet points and list markers
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Remove bold (**text** or __text__)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // Remove italics (*text* or _text_) - must come after bold
    .replace(/\*([^*\n]+?)\*/g, '$1')
    .replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g, '$1')
    // Remove inline code
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Clean JSON artifacts from blog body - AGGRESSIVELY
function cleanBlogBody(body: string): string {
  if (!body) return '';
  
  // 1. If it's a stringified JSON array, join it
  let input = body.trim();
  if (input.startsWith('[') && input.endsWith(']')) {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        input = parsed.join('\n\n');
      }
    } catch (e) {
      // Proceed with original string if parse fails
    }
  }

  // 2. Unescape common HTML entities before cleaning
  let cleaned = input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  cleaned = cleaned
    // Remove entire meta_description line at end
    .replace(/["']?meta_description["']?\s*:\s*["'][^"']*["']\s*[\}\]]*\s*$/gi, '')
    // Remove JSON ending patterns
    .replace(/}\s*$/g, '')
    .replace(/"\s*$/g, '')
    .replace(/,\s*$/g, '')
    // Remove JSON-like patterns that shouldn't be in body
    .replace(/^["']?json["']?\s*/i, '')
    .replace(/^\{\s*"title":/m, '')
    .replace(/^"body":\s*"/m, '')
    .replace(/"body":\s*"/g, '')
    // Remove trailing field names
    .replace(/",?\s*"(slug_suggestion|meta_description|outline|title)":\s*.*/g, '')
    .replace(/^"(slug_suggestion|meta_description|outline|title)":\s*.*/gm, '')
    // Remove JSON structural characters on their own lines
    .replace(/^[\s]*[\{\}\[\]]+[\s]*$/gm, '')
    .replace(/^\s*"\s*,?\s*$/gm, '')
    // Remove HTML tags - VERY AGGRESSIVE
    .replace(/<[^>]+>/g, '')
    // Remove residual JSON-like quotes and commas at line ends
    .replace(/^[\s]*"([^"]+)",?[\s]*$/gm, '$1') 
    .replace(/^[\s]*"([^"]+)"[\s]*$/gm, '$1')
    // Remove leading/trailing array brackets if they escaped previous checks
    .replace(/^[\s]*\[\s*/m, '')
    .replace(/\s*\][\s]*$/m, '')
    // Clean escaped quotes and newlines from raw JSON
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    // Final pass for residual structural chars
    .replace(/[{}|[\]]/g, '')
    // Clean up multiple newlines and whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // Final cleanup - remove any trailing JSON-like content after last paragraph
  const lines = cleaned.split('\n');
  const cleanedLines = lines.filter((line: string) => {
    const trimmed = line.trim();
    // Skip lines that look like JSON fragments
    if (trimmed.match(/^["']?(meta_description|slug_suggestion|outline|title)["']?\s*:/)) return false;
    if (trimmed === '{' || trimmed === '}' || trimmed === '[' || trimmed === ']') return false;
    if (trimmed === '"' || trimmed === '",') return false;
    return true;
  });
  
  // Remove leading and trailing quotes if they wrapped the whole result
  let finalResult = cleanedLines.join('\n').trim();
  if (finalResult.startsWith('"')) finalResult = finalResult.slice(1);
  if (finalResult.endsWith('"')) finalResult = finalResult.slice(0, -1);
  
  return finalResult.trim();
}

function formatResults(tool: string, data: any) {
  switch (tool) {
    case 'email_subject': {
      const arr = Array.isArray(data) ? data : [];
      return arr.map((item) => ({
        text: stripBasicMarkdown(String(item?.text ?? '')),
        openRate: String(item?.openRate ?? ''),
        trigger: String(item?.trigger ?? ''),
        charCount: Number(item?.charCount ?? 0),
      }));
    }
    case 'resume': {
      const arr = Array.isArray(data) ? data : [];
      return arr.map((item) => ({
        text: stripBasicMarkdown(String(item?.text ?? '')),
        actionVerb: String(item?.actionVerb ?? ''),
        score: String(item?.score ?? ''),
      }));
    }
    case 'cold_email': {
      const arr = Array.isArray(data) ? data : [];
      return arr.map((item) => ({
        text: stripBasicMarkdown(String(item?.text ?? '')),
        hook: stripBasicMarkdown(String(item?.hook ?? '')),
        tips: Array.isArray(item?.tips) ? item.tips.map((t: any) => stripBasicMarkdown(String(t))) : [],
        followUps: Array.isArray(item?.followUps)
          ? item.followUps.map((t: any) => stripBasicMarkdown(String(t)))
          : [],
      }));
    }
    case 'product_description': {
      const arr = Array.isArray(data) ? data : [];
      return arr.map((item) => ({
        text: stripBasicMarkdown(String(item?.text ?? '')),
        tone: String(item?.tone ?? ''),
        seoKeywords: Array.isArray(item?.seoKeywords)
          ? item.seoKeywords.map((t: any) => String(t))
          : [],
        metaDescription: stripBasicMarkdown(String(item?.metaDescription ?? '')),
        cta: stripBasicMarkdown(String(item?.cta ?? '')),
        bullets: Array.isArray(item?.bullets) ? item.bullets.map((t: any) => stripBasicMarkdown(String(t))) : [],
      }));
    }
    case 'job_description': {
      if (data && typeof data === 'object') {
        return {
          roleSummary: stripBasicMarkdown(String(data?.roleSummary ?? '')),
          responsibilities: Array.isArray(data?.responsibilities)
            ? data.responsibilities.map((t: any) => stripBasicMarkdown(String(t)))
            : [],
          requiredQualifications: Array.isArray(data?.requiredQualifications)
            ? data.requiredQualifications.map((t: any) => stripBasicMarkdown(String(t)))
            : [],
          niceToHave: Array.isArray(data?.niceToHave)
            ? data.niceToHave.map((t: any) => stripBasicMarkdown(String(t)))
            : [],
          salaryRange: String(data?.salaryRange ?? ''),
          culture: stripBasicMarkdown(String(data?.culture ?? '')),
          eeoStatement: stripBasicMarkdown(String(data?.eeoStatement ?? '')),
          complianceNotes: Array.isArray(data?.complianceNotes)
            ? data.complianceNotes.map((t: any) => stripBasicMarkdown(String(t)))
            : [],
        };
      }
      return {
        roleSummary: stripBasicMarkdown(String(data ?? '')),
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
        text: stripBasicMarkdown(String(item?.text ?? '')),
        engagementScore: String(item?.engagementScore ?? ''),
        hashtags: String(item?.hashtags ?? ''),
        emojiSuggestions: Array.isArray(item?.emojiSuggestions)
          ? item.emojiSuggestions.map((t: any) => String(t))
          : [],
      }));
    }
    case 'social_ad': {
      const arr = Array.isArray(data) ? data : [];
      return arr.map((item) => ({
        text: stripBasicMarkdown(String(item?.text ?? '')),
        platform: String(item?.platform ?? ''),
        predictedCtr: String(item?.predictedCtr ?? ''),
        trigger: String(item?.trigger ?? ''),
        charCount: Number(item?.charCount ?? 0),
      }));
    }
    case 'summarizer': {
      if (data && typeof data === 'object') {
        return {
          summary: stripBasicMarkdown(String(data?.summary ?? '')),
          readability: String(data?.readability ?? ''),
          keyPoints: Array.isArray(data?.keyPoints)
            ? data.keyPoints.map((t: any) => stripBasicMarkdown(String(t)))
            : [],
          keywords: Array.isArray(data?.keywords)
            ? data.keywords.map((t: any) => String(t))
            : [],
          readingTime: String(data?.readingTime ?? ''),
          timeSaved: String(data?.timeSaved ?? ''),
        };
      }
      return {
        summary: stripBasicMarkdown(String(data ?? '')),
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
          text: stripBasicMarkdown(String(data?.text ?? '')),
          atsScore: String(data?.atsScore ?? ''),
          openingHook: stripBasicMarkdown(String(data?.openingHook ?? '')),
          closing: stripBasicMarkdown(String(data?.closing ?? '')),
        };
      }
      return { text: stripBasicMarkdown(String(data ?? '')), atsScore: '', openingHook: '', closing: '' };
    }
    case 'twitter_thread': {
      if (data && typeof data === 'object') {
        return {
          tweets: Array.isArray(data?.tweets)
            ? data.tweets.map((t: any) => stripBasicMarkdown(String(t)))
            : [],
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
            ? data.items.map((it: any) => ({
                question: stripBasicMarkdown(String(it?.question ?? '')),
                answer: stripBasicMarkdown(String(it?.answer ?? '')),
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
            ? data.segments.map((s: any) => ({
                time: String(s?.time ?? ''),
                line: stripBasicMarkdown(String(s?.line ?? '')),
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
        // Handle array body
        const bodyValue = (item as any)?.body ?? (item as any)?.content ?? '';
        const rawBody = Array.isArray(bodyValue) ? bodyValue.join('\n\n') : String(bodyValue);
        
        const cleanedBody = cleanBlogBody(stripBasicMarkdown(rawBody));
        
        console.log('[API][generate] blog_post cleaning results:', {
          rawLength: rawBody.length,
          cleanedLength: cleanedBody.length,
          hasTags: cleanedBody.includes('<')
        });
        
        return {
          title: stripBasicMarkdown(String((item as any)?.title ?? '')),
          slug_suggestion: stripBasicMarkdown(String((item as any)?.slug_suggestion ?? '')),
          outline: Array.isArray((item as any)?.outline)
            ? (item as any).outline.map((t: any) => stripBasicMarkdown(String(t ?? '')))
            : [],
          body: cleanedBody,
          meta_description: stripBasicMarkdown(String((item as any)?.meta_description ?? '')),
        };
      }
      return {
        title: '',
        slug_suggestion: '',
        outline: [],
        body: cleanBlogBody(stripBasicMarkdown(String(item ?? data ?? ''))),
        meta_description: '',
      };
    }
    case 'article_from_outline': {
      const item = Array.isArray(data) ? data[0] : data;
      if (item && typeof item === 'object') {
        return {
          title: stripBasicMarkdown(String((item as any)?.title ?? '')),
          outline: Array.isArray((item as any)?.outline)
            ? (item as any).outline.map((t: any) => stripBasicMarkdown(String(t ?? '')))
            : [],
          body: stripBasicMarkdown(String((item as any)?.body ?? '')),
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
          optimized_title: stripBasicMarkdown(String((item as any)?.optimized_title ?? '')),
          optimized_meta_description: stripBasicMarkdown(String((item as any)?.optimized_meta_description ?? '')),
          optimized_body: stripBasicMarkdown(String((item as any)?.optimized_body ?? '')),
          suggested_headings: Array.isArray((item as any)?.suggested_headings)
            ? (item as any).suggested_headings.map((t: any) => stripBasicMarkdown(String(t ?? '')))
            : [],
          keyword_usage_notes: Array.isArray((item as any)?.keyword_usage_notes)
            ? (item as any).keyword_usage_notes.map((t: any) => stripBasicMarkdown(String(t ?? '')))
            : [],
          improvements_summary: stripBasicMarkdown(String((item as any)?.improvements_summary ?? '')),
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
          headline: stripBasicMarkdown(String((item as any)?.headline ?? '')),
          summary: stripBasicMarkdown(String((item as any)?.summary ?? '')),
          background: stripBasicMarkdown(String((item as any)?.background ?? '')),
          challenge: stripBasicMarkdown(String((item as any)?.challenge ?? '')),
          solution: stripBasicMarkdown(String((item as any)?.solution ?? '')),
          results: stripBasicMarkdown(String((item as any)?.results ?? '')),
          quote: stripBasicMarkdown(String((item as any)?.quote ?? '')),
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
          hero_headline: stripBasicMarkdown(String((item as any)?.hero_headline ?? '')),
          hero_subheadline: stripBasicMarkdown(String((item as any)?.hero_subheadline ?? '')),
          hero_cta: stripBasicMarkdown(String((item as any)?.hero_cta ?? '')),
          sections: Array.isArray((item as any)?.sections)
            ? (item as any).sections.map((s: any) => ({
                title: stripBasicMarkdown(String(s?.title ?? '')),
                body: stripBasicMarkdown(String(s?.body ?? '')),
              }))
            : [],
          faq_items: Array.isArray((item as any)?.faq_items)
            ? (item as any).faq_items.map((f: any) => ({
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
          title: stripBasicMarkdown(String((item as any)?.title ?? '')),
          abstract: stripBasicMarkdown(String((item as any)?.abstract ?? '')),
          sections: Array.isArray((item as any)?.sections)
            ? (item as any).sections.map((s: any) => ({
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
      // Handle nested response structure: { response: [ { text: "..." }, ... ] }
      let normalizedData = data;
      if (data && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.response)) {
        normalizedData = data.response;
      }
      
      const arr = Array.isArray(normalizedData) ? normalizedData : normalizedData ? [normalizedData] : [];
      return arr.map((item: any) => {
        let text = '';

        if (item && typeof item === 'object') {
          // Direct text field
          if (typeof item.text === 'string' && item.text.trim()) {
            text = item.text.trim();
          } else if (typeof item.content === 'string' && item.content.trim()) {
            text = item.content.trim();
          } else if (Array.isArray(item.outline)) {
            text = item.outline.map((line: any) => String(line ?? '')).join('\n');
          } else if (typeof item.outline === 'string') {
            text = item.outline;
          } else if (typeof item.body === 'string') {
            text = item.body;
          } else {
            // Fallback: extract any string value from the object
            const values = Object.values(item).filter(v => typeof v === 'string' && (v as string).trim());
            if (values.length > 0) {
              text = values.join('\n\n');
            } else {
              text = String(item ?? '');
            }
          }
        } else if (typeof item === 'string') {
          text = item;
        } else {
          text = String(item ?? '');
        }

        return { text: stripBasicMarkdown(text) };
      });
    }
    case 'copy_helper': {
      // Handle nested response structure
      let normalizedData = data;
      if (data && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.response)) {
        normalizedData = data.response;
      }
      const arr = Array.isArray(normalizedData) ? normalizedData : normalizedData ? [normalizedData] : [];
      return arr.map((item: any) => {
        if (typeof item === 'string') {
          return { text: stripBasicMarkdown(item) };
        }
        const text = typeof item?.text === 'string'
          ? item.text
          : typeof item?.content === 'string'
            ? item.content
            : String(item ?? '');
        return { text: stripBasicMarkdown(text) };
      });
    }
    case 'social_helper': {
      // Handle nested response structure
      let normalizedData = data;
      if (data && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.response)) {
        normalizedData = data.response;
      }
      const arr = Array.isArray(normalizedData) ? normalizedData : normalizedData ? [normalizedData] : [];
      return arr.map((item: any) => {
        let base: string;
        if (typeof item === 'string') {
          base = item;
        } else if (typeof item?.text === 'string') {
          base = item.text;
        } else if (typeof item?.content === 'string') {
          base = item.content;
        } else {
          base = String(item ?? '');
        }
        return { text: stripBasicMarkdown(base) };
      });
    }
    case 'email_writer': {
      // Handle nested response structure
      let normalizedData = data;
      if (data && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.response)) {
        normalizedData = data.response;
      }
      const arr = Array.isArray(normalizedData) ? normalizedData : normalizedData ? [normalizedData] : [];
      return arr.map((item: any) => {
        if (typeof item === 'string') {
          return { text: stripBasicMarkdown(item) };
        }
        const text = typeof item?.text === 'string'
          ? item.text
          : typeof item?.content === 'string'
            ? item.content
            : String(item ?? '');
        return { text: stripBasicMarkdown(text) };
      });
    }
    case 'rewrite_helper': {
      // Handle nested response structure
      let normalizedData = data;
      if (data && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.response)) {
        normalizedData = data.response;
      }
      const arr = Array.isArray(normalizedData) ? normalizedData : normalizedData ? [normalizedData] : [];
      return arr.map((item: any) => {
        if (typeof item === 'string') {
          return { text: stripBasicMarkdown(item) };
        }
        const text = typeof item?.text === 'string'
          ? item.text
          : typeof item?.content === 'string'
            ? item.content
            : String(item ?? '');
        return { text: stripBasicMarkdown(text) };
      });
    }
    default:
      return data;
  }
}

async function generateWithRetry(model: any, prompt: string, maxAttempts = 3, config?: any) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const req = config
        ? { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: config }
        : prompt;
      const resp = await model.generateContent(req);
      const text = resp.response.text();
      return { text, attempts: attempt };
    } catch (err: any) {
      const msg = String(err?.message || err);
      const retryable = /ECONNRESET|incomplete envelope|fetch failed|network|connection reset/i.test(
        msg,
      );
      if (attempt < maxAttempts && retryable) {
        const delay = 250 * Math.pow(2, attempt - 1);
        console.warn(
          `[API][generate] Retry attempt ${attempt} failed: ${msg}. Retrying in ${delay}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Unreachable');
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ message: 'Method not allowed' });
    }

    const t0 = Date.now();
    console.log('[API][generate] Incoming request');

    const parsed = ToolSchema.safeParse(req.body || {});
    if (!parsed.success) {
      console.error('[API][generate] Validation failed', parsed.error.flatten());
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Invalid inputs',
        details: parsed.error.flatten(),
        debug: { received: req.body },
      });
    }

    const { tool, inputs, outputCount = 3, tone, brandVoiceId } = parsed.data;

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    
    if (!openRouterKey && !geminiKey) {
      console.error('[API][generate] No API key found (OPENROUTER_API_KEY or GEMINI_API_KEY)');
      const fallback = buildFallbackResults(tool, inputs, outputCount);
      const t1 = Date.now();
      return res.status(200).json({
        results: fallback,
        debug: {
          tool,
          durationMs: t1 - t0,
          model: 'fallback-no-api-key',
          creditsCharged: 0,
        },
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const userId = getUserIdFromHeader(req);

    if (isUnsafeContent(tool, inputs)) {
      const formatted = buildSafeResults(tool, inputs);
      const t1 = Date.now();
      return res.status(200).json({
        results: formatted,
        debug: { tool, durationMs: t1 - t0, model: 'safety-filter', blocked: true },
      });
    }

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
    let orgCreditsBalance: number | null = null;
    let orgId = getOrgIdFromHeader(req);
    
    // Fallback if orgId is missing from header
    if (!orgId && supabaseAdmin && userId) {
      try {
        const { data: membership } = await supabaseAdmin
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', userId)
          .order('created_at')
          .limit(1)
          .maybeSingle();
        if (membership) {
          orgId = membership.organization_id;
          console.log('[API][generate] Fallback orgId found:', orgId);
        }
      } catch (err) {
        console.warn('[API][generate] Org fallback error:', err);
      }
    }
    
    console.log('[API][generate] Credit check - userId:', userId, 'orgId:', orgId);

    // Check organization credits (primary credit system for subscriptions)
    if (supabaseAdmin && orgId) {
      try {
        const { data, error } = await supabaseAdmin
          .from('organization_credits')
          .select('balance_credits')
          .eq('organization_id', orgId)
          .maybeSingle();
        if (error) throw error;
        if (data && typeof data.balance_credits === 'number') {
          orgCreditsBalance = data.balance_credits;
          if (data.balance_credits < creditsCharged) {
            console.warn('[API][generate] Insufficient organization credits', {
              required: creditsCharged,
              balance: data.balance_credits,
              orgId,
            });
            return res.status(402).json({
              error: 'INSUFFICIENT_CREDITS',
              message: 'Not enough credits to generate for this tool',
              debug: { required: creditsCharged, balance: data.balance_credits },
            });
          }
        }
      } catch (e: any) {
        console.warn('[API][generate] Org credits check failed', e?.message || e);
      }
    }

    try {
      // Prefer OpenRouter, fallback to Gemini
      const useOpenRouter = !!openRouterKey;
      const modelName = useOpenRouter 
        ? (process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001')
        : (process.env.GEMINI_MODEL || 'gemini-2.0-flash');
      
      console.log(`[API][generate] Using ${useOpenRouter ? 'OpenRouter' : 'Gemini'} with model: ${modelName}`);
      
      const model = useOpenRouter
        ? getOpenRouterModel(openRouterKey!, modelName)
        : (() => {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(geminiKey);
            return genAI.getGenerativeModel({ model: modelName });
          })();

      let brandContext = '';
      if (brandVoiceId && supabaseAdmin) {
          try {
            const { data: voice } = await supabaseAdmin
                .from('brand_voices')
                .select('*, brand_voice_samples(*)')
                .eq('id', brandVoiceId)
                .single();
            
            if (voice) {
                const rules = (voice as any).rules || {};
                const dos = Array.isArray(rules.dos) ? rules.dos.join(', ') : '';
                const donts = Array.isArray(rules.donts) ? rules.donts.join(', ') : '';
                const samples = (voice as any).brand_voice_samples?.map((s: any) => s.content).join('\n---\n') || '';

                brandContext = `\n\n*** BRAND VOICE INSTRUCTIONS ***\nYou must adhere to the following Brand Voice profile:\n- Name: ${voice.name}\n- Description: ${voice.description || 'N/A'}\n- Tone: ${(voice as any).tone_tags?.join(', ') || 'N/A'}\n- DO: ${dos}\n- DON'T: ${donts}\n\n${samples ? `Style Samples (emulate this writing style):\n${samples}\n` : ''}*** END BRAND VOICE ***\n\n`;
            }
          } catch (e) {
              console.warn('[Generate] Failed to fetch brand voice', e);
          }
      }
      
      console.log('[API][generate] Brand voice check', {
        brandVoiceId: brandVoiceId || 'none',
        hasBrandContext: brandContext.length > 0,
        brandContextPreview: brandContext.slice(0, 200),
      });

      const prompt = buildPrompt(tool, inputs, outputCount, tone) + brandContext;
      const finalPrompt = `${prompt}\n\nIMPORTANT: You MUST return your response as a valid JSON object. Do NOT wrap it in code fences like \`\`\`json. Do NOT include any text before or after the JSON. Start your response with { and end with }.`;

      // Dynamic max token limit based on length input
      let maxOutputTokens = 16384;
      if (tool === 'blog_post' || tool === 'article_from_outline') {
        // 'medium' -> ~4000 tokens (~2000 words)
        // 'long' -> max tokens for 3000+ words
        if (inputs.length === 'medium') maxOutputTokens = 4000;
      }

      const { text, attempts } = await generateWithRetry(model, finalPrompt, 3, {
        maxOutputTokens,
      });

      let parsedJson: any = null;
      
      // Strip markdown code fences if present (```json ... ``` or ```ai ... ```)
      let cleanedText = text.trim();
      
      // Remove code fences - use greedy matching to get all content
      // Match opening fence, capture everything until closing fence
      const codeFenceRegex = /```(?:json|ai|javascript|js|typescript|ts)?\s*\n?([\s\S]*?)```/gi;
      const fenceMatches = [...cleanedText.matchAll(codeFenceRegex)];
      if (fenceMatches.length > 0) {
        // Get the largest match (in case there are multiple code blocks)
        cleanedText = fenceMatches.reduce((longest, match) => 
          match[1].length > longest.length ? match[1] : longest, '').trim();
      }
      
      // If still has code fence markers, remove them line by line
      cleanedText = cleanedText
        .replace(/^```[\w]*\s*$/gm, '')
        .replace(/^```\s*$/gm, '')
        .trim();
      
      console.log('[API][generate] Cleaned text preview:', cleanedText.slice(0, 200));
      
      try {
        parsedJson = JSON.parse(cleanedText);
      } catch {
        // Try to extract JSON object or array from the text
        const jsonMatch = cleanedText.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
          try {
            parsedJson = JSON.parse(jsonMatch[1]);
          } catch {
            // Try to find a valid JSON by looking for balanced braces
            const startIdx = cleanedText.indexOf('{');
            if (startIdx !== -1) {
              let depth = 0;
              let endIdx = -1;
              for (let i = startIdx; i < cleanedText.length; i++) {
                if (cleanedText[i] === '{') depth++;
                else if (cleanedText[i] === '}') {
                  depth--;
                  if (depth === 0) {
                    endIdx = i;
                    break;
                  }
                }
              }
              if (endIdx !== -1) {
                try {
                  parsedJson = JSON.parse(cleanedText.slice(startIdx, endIdx + 1));
                } catch {
                  parsedJson = null;
                }
              }
            }
          }
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
        const safeRaw = cleanBlogBody(stripBasicMarkdown(String(text || '')));
        switch (tool) {
          case 'blog_post':
            parsedJson = {
              title: String((inputs as any)?.topic || 'Draft blog post'),
              slug_suggestion: '',
              outline: [],
              body: safeRaw,
              meta_description: '',
            };
            break;
          case 'article_from_outline':
            parsedJson = {
              title: String((inputs as any)?.topic || 'Draft article'),
              outline: [],
              body: safeRaw,
            };
            break;
          case 'seo_blog_optimizer':
            parsedJson = {
              optimized_title: String((inputs as any)?.topic || 'Optimized article'),
              optimized_meta_description: '',
              optimized_body: safeRaw,
              suggested_headings: [],
              keyword_usage_notes: [],
              improvements_summary: '',
            };
            break;
          case 'case_study_writer':
            parsedJson = {
              headline: String((inputs as any)?.clientName || 'Case study'),
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
              hero_headline: String((inputs as any)?.benefit || 'Landing page draft'),
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
              title: String((inputs as any)?.topic || 'Report'),
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
        console.error('[API][generate] JSON parse failed', { preview: text.slice(0, 300) });
        return res.status(502).json({
          error: 'BAD_MODEL_OUTPUT',
          message: 'Model did not return valid JSON',
          debug: { rawPreview: text.slice(0, 1000) },
        });
      }

      // Debug logging for blog_post to trace body field issue
      if (tool === 'blog_post') {
        const bodyField = parsedJson?.body || parsedJson?.content || '';
        console.log('[API][generate] blog_post parsed fields:', {
          hasTitle: !!parsedJson?.title,
          hasBody: !!bodyField,
          bodyLength: bodyField?.length || 0,
          outlineLength: parsedJson?.outline?.length || 0,
          allKeys: Object.keys(parsedJson || {})
        });
      }

      const formatted = formatResults(tool, parsedJson);

      // Deduct from organization credits
      if (supabaseAdmin && orgId && orgCreditsBalance !== null) {
        try {
          const newBalance = Math.max(0, Number(orgCreditsBalance) - Number(creditsCharged));
          await supabaseAdmin
            .from('organization_credits')
            .update({ balance_credits: newBalance })
            .eq('organization_id', orgId);
          console.log('[API][generate] Organization credits deducted', {
            orgId,
            oldBalance: orgCreditsBalance,
            newBalance,
            creditsCharged,
          });
        } catch (e: any) {
          console.warn('[API][generate] Organization credits deduction failed', e?.message || e);
        }
      }

      // Log usage to usage_events table (for analytics)
      if (supabaseAdmin && userId) {
        try {
          await supabaseAdmin
            .from('usage_events')
            .insert({
              user_id: userId,
              organization_id: orgId || null,
              tool: tool,
              credits: creditsCharged,
              metadata: { inputs: Object.keys(inputs) },
            });
          console.log('[API][generate] Usage event logged to analytics');
        } catch (err: any) {
          console.error('[API][generate] Usage event log failed', err);
        }
      }

      const t1 = Date.now();
      return res.status(200).json({
        results: formatted,
        debug: {
          tool,
          durationMs: t1 - t0,
          model: modelName,
          creditsCharged,
          attemptsUsed: attempts,
        },
      });
    } catch (err: any) {
      console.error('[API][generate] Error', err);
      try {
        const fallback = buildFallbackResults(tool, inputs, outputCount);
        const t1 = Date.now();
        return res.status(200).json({
          results: fallback,
          debug: {
            tool,
            durationMs: t1 - t0,
            model: 'fallback-error',
            errorMessage: err?.message,
            creditsCharged: 0,
          },
        });
      } catch (fallbackErr: any) {
        console.error('[API][generate] Fallback failed', fallbackErr);
        return res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Generation failed',
          debug: {
            message: err?.message,
            fallbackError: fallbackErr?.message,
            stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
          },
        });
      }
    }
  } catch (outerErr: any) {
    console.error('[API][generate] Top-level error', outerErr);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Generation failed (top-level)',
      debug: {
        message: outerErr?.message,
        stack: process.env.NODE_ENV === 'development' ? outerErr?.stack : undefined,
      },
    });
  }
}
