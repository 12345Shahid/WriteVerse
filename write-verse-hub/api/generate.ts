import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

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
      const isLong = inputs.length === 'long';
      // We treat 'short' as 'medium' now since short is removed from UI
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
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1');
}

function formatResults(tool: string, data: any) {
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
        tips: Array.isArray(item?.tips) ? item.tips.map((t: any) => String(t)) : [],
        followUps: Array.isArray(item?.followUps)
          ? item.followUps.map((t: any) => String(t))
          : [],
      }));
    }
    case 'product_description': {
      const arr = Array.isArray(data) ? data : [];
      return arr.map((item) => ({
        text: String(item?.text ?? ''),
        tone: String(item?.tone ?? ''),
        seoKeywords: Array.isArray(item?.seoKeywords)
          ? item.seoKeywords.map((t: any) => String(t))
          : [],
        metaDescription: String(item?.metaDescription ?? ''),
        cta: String(item?.cta ?? ''),
        bullets: Array.isArray(item?.bullets) ? item.bullets.map((t: any) => String(t)) : [],
      }));
    }
    case 'job_description': {
      if (data && typeof data === 'object') {
        return {
          roleSummary: String(data?.roleSummary ?? ''),
          responsibilities: Array.isArray(data?.responsibilities)
            ? data.responsibilities.map((t: any) => String(t))
            : [],
          requiredQualifications: Array.isArray(data?.requiredQualifications)
            ? data.requiredQualifications.map((t: any) => String(t))
            : [],
          niceToHave: Array.isArray(data?.niceToHave)
            ? data.niceToHave.map((t: any) => String(t))
            : [],
          salaryRange: String(data?.salaryRange ?? ''),
          culture: String(data?.culture ?? ''),
          eeoStatement: String(data?.eeoStatement ?? ''),
          complianceNotes: Array.isArray(data?.complianceNotes)
            ? data.complianceNotes.map((t: any) => String(t))
            : [],
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
        emojiSuggestions: Array.isArray(item?.emojiSuggestions)
          ? item.emojiSuggestions.map((t: any) => String(t))
          : [],
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
          keyPoints: Array.isArray(data?.keyPoints)
            ? data.keyPoints.map((t: any) => String(t))
            : [],
          keywords: Array.isArray(data?.keywords)
            ? data.keywords.map((t: any) => String(t))
            : [],
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
          tweets: Array.isArray(data?.tweets)
            ? data.tweets.map((t: any) => String(t))
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
            ? data.segments.map((s: any) => ({
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
          title: stripBasicMarkdown(String((item as any)?.title ?? '')),
          slug_suggestion: stripBasicMarkdown(String((item as any)?.slug_suggestion ?? '')),
          outline: Array.isArray((item as any)?.outline)
            ? (item as any).outline.map((t: any) => stripBasicMarkdown(String(t ?? '')))
            : [],
          body: stripBasicMarkdown(String((item as any)?.body ?? '')),
          meta_description: stripBasicMarkdown(String((item as any)?.meta_description ?? '')),
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
      const arr = Array.isArray(data) ? data : data ? [data] : [];
      return arr.map((item: any) => {
        let text = '';

        if (item && typeof item === 'object') {
          if (typeof item.text === 'string' && item.text.trim()) {
            const raw = item.text.trim();

            if ((raw.startsWith('{') || raw.startsWith('[')) && raw.includes('"outline"')) {
              try {
                const parsed = JSON.parse(raw);
                if (Array.isArray((parsed as any)?.outline)) {
                  text = (parsed as any).outline.map((line: any) => String(line ?? '')).join('\n');
                } else {
                  text = raw;
                }
              } catch {
                text = raw;
              }
            } else {
              text = raw;
            }
          } else if (Array.isArray((item as any).outline)) {
            text = (item as any).outline.map((line: any) => String(line ?? '')).join('\n');
          } else if (typeof (item as any).outline === 'string') {
            text = String((item as any).outline);
          } else if (typeof (item as any).content === 'string') {
            text = String((item as any).content);
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
      return arr.map((item: any) => {
        if (typeof item === 'string') {
          return { text: item };
        }
        const text = typeof item?.text === 'string'
          ? item.text
          : (() => {
              try {
                return JSON.stringify(item, null, 2);
              } catch {
                return String(item ?? '');
              }
            })();
        return { text };
      });
    }
    case 'social_helper': {
      const cleanText = (value: string) => {
        if (!value) return '';
        let cleaned = value.replace(/\*/g, '');
        cleaned = cleaned.replace(
          /[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{2600}-\u{27BF}]/gu,
          '',
        );
        cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
        return cleaned;
      };
      const arr = Array.isArray(data) ? data : data ? [data] : [];
      return arr.map((item: any) => {
        let base: string;
        if (typeof item === 'string') {
          base = item;
        } else if (typeof item?.text === 'string') {
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
      return arr.map((item: any) => {
        if (typeof item === 'string') {
          return { text: item };
        }
        const text = typeof item?.text === 'string'
          ? item.text
          : (() => {
              try {
                return JSON.stringify(item, null, 2);
              } catch {
                return String(item ?? '');
              }
            })();
        return { text };
      });
    }
    case 'rewrite_helper': {
      const arr = Array.isArray(data) ? data : data ? [data] : [];
      return arr.map((item: any) => {
        if (typeof item === 'string') {
          return { text: item };
        }
        const text = typeof item?.text === 'string'
          ? item.text
          : (() => {
              try {
                return JSON.stringify(item, null, 2);
              } catch {
                return String(item ?? '');
              }
            })();
        return { text };
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

    const { tool, inputs, outputCount = 3, tone } = parsed.data;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('[API][generate] GEMINI_API_KEY / GOOGLE_API_KEY missing');
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
            console.warn('[API][generate] Insufficient credits', {
              required: creditsCharged,
              balance: data.credits_balance,
            });
            return res.status(402).json({
              error: 'INSUFFICIENT_CREDITS',
              message: 'Not enough credits to generate for this tool',
              debug: { required: creditsCharged, balance: data.credits_balance },
            });
          }
        }
      } catch (e: any) {
        console.warn('[API][generate] Credits enforcement skipped', e?.message || e);
      }
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      const model = genAI.getGenerativeModel({ model: modelName });

      const prompt = buildPrompt(tool, inputs, outputCount, tone);
      const finalPrompt = `${prompt}\n\nReturn strictly valid JSON. Do not include code fences.`;

      // Dynamic max token limit based on length input
      let maxOutputTokens = 8192;
      if (tool === 'blog_post' || tool === 'article_from_outline') {
        // 'short' is removed from UI, treating as medium just in case
        // 'medium' -> ~2500 tokens (~1500 words)
        // 'long' -> max tokens (8192) for 3000+ words
        if (inputs.length === 'medium') maxOutputTokens = 2500;
      }

      const { text, attempts } = await generateWithRetry(model, finalPrompt, 3, {
        maxOutputTokens,
      });

      let parsedJson: any = null;
      try {
        parsedJson = JSON.parse(text);
      } catch {
        const match = text.match(/\[.*\]|\{.*\}/s);
        if (match) {
          try {
            parsedJson = JSON.parse(match[0]);
          } catch {
            parsedJson = null;
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
        const safeRaw = stripBasicMarkdown(String(text || ''));
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

      const formatted = formatResults(tool, parsedJson);

      if (supabaseAdmin && userId && userCreditsBalance !== null) {
        try {
          const newBalance = Math.max(0, Number(userCreditsBalance) - Number(creditsCharged));
          await supabaseAdmin
            .from('users')
            .update({ credits_balance: newBalance })
            .eq('id', userId);
          console.debug('[API][generate] Credits deducted', {
            userId,
            oldBalance: userCreditsBalance,
            newBalance,
          });
        } catch (e: any) {
          console.warn('[API][generate] Credits deduction failed', e?.message || e);
        }
      }

      if (supabaseAdmin && userId) {
        try {
          await supabaseAdmin
            .from('tool_usage')
            .insert({
              user_id: userId,
              tool_name: tool,
              input_tokens_used: null,
              output_tokens_used: null,
              timestamp: new Date().toISOString(),
            });
          console.log('[API][generate] Usage logged');
        } catch (err: any) {
          console.error('[API][generate] Usage log failed', err);
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
