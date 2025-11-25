import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Initialize clients (same as index.js)
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

/**
 * Resolve input parameters by substituting variables like {{step1.result.text}}
 */
function resolveInputs(params, inputMap, context) {
  const resolved = { ...params };
  
  for (const [key, valueTemplate] of Object.entries(inputMap || {})) {
    if (typeof valueTemplate === 'string' && valueTemplate.startsWith('{{') && valueTemplate.endsWith('}}')) {
      // e.g. {{step1.result.text}}
      const path = valueTemplate.slice(2, -2).trim(); // step1.result.text
      const parts = path.split('.');
      const stepId = parts[0];
      
      if (context[stepId]) {
        // Traverse the object path
        let val = context[stepId];
        for (let i = 1; i < parts.length; i++) {
            if (val) val = val[parts[i]];
        }
        resolved[key] = val;
      }
    } else {
      // Literal value
      resolved[key] = valueTemplate;
    }
  }
  return resolved;
}

/**
 * Execute a single workflow
 */
export async function runWorkflow(workflowId, userId, orgId, initialInputs) {
  if (!supabaseAdmin || !genAI) throw new Error('Server misconfigured');

  // 1. Create Execution Record
  const { data: execution, error: createError } = await supabaseAdmin
    .from('workflow_executions')
    .insert({
      workflow_id: workflowId,
      organization_id: orgId,
      user_id: userId,
      status: 'running',
      results: {},
      current_step_index: 0
    })
    .select()
    .single();

  if (createError) throw createError;

  const executionId = execution.id;

  try {
    // 2. Fetch Workflow Definition
    const { data: workflow } = await supabaseAdmin
      .from('workflows')
      .select('steps')
      .eq('id', workflowId)
      .single();
      
    if (!workflow) throw new Error('Workflow not found');

    const steps = workflow.steps || [];
    if (steps.length > 6) {
        throw new Error("Workflow limit exceeded: Maximum 6 steps allowed.");
    }

    const context = {
        initial: initialInputs // Access via {{initial.topic}}
    };

    // 3. Execute Steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      // Update status
      await supabaseAdmin
        .from('workflow_executions')
        .update({ current_step_index: i })
        .eq('id', executionId);

      // Prepare Inputs
      const inputs = resolveInputs(step.params, step.input_map, context);

      // Execute Tool (Call LLM)
      // We need to reuse the buildPrompt/generate logic from index.js
      // For MVP, I'll inline a simplified version or we can import if we refactor index.js
      // I'll implement a direct call here for now to avoid huge refactor risks
      
      const result = await executeToolStep(step.tool, inputs);
      
      // Store Result
      context[step.id] = result; // Save for future steps
      
      // Persist partial results
      await supabaseAdmin
        .from('workflow_executions')
        .update({ 
            results: context 
        })
        .eq('id', executionId);
    }

    // 4. Complete
    await supabaseAdmin
      .from('workflow_executions')
      .update({ 
        status: 'completed', 
        completed_at: new Date().toISOString() 
      })
      .eq('id', executionId);

    return { success: true, results: context };

  } catch (err) {
    // Log Failure
    await supabaseAdmin
      .from('workflow_executions')
      .update({ 
        status: 'failed', 
        error: err.message 
      })
      .eq('id', executionId);
      
    throw err;
  }
}

// Reuse prompt logic (simplified for workflow context)
async function executeToolStep(tool, inputs) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }, { apiVersion: 'v1' });
  
  const tone = inputs.tone || '';
  const outputCount = inputs.outputCount || 3;
  
  let prompt = "";
  
  switch (tool) {
    case 'email_subject':
      prompt = `Generate ${outputCount} email subject lines for: ${inputs.topic}\nTarget audience: ${inputs.audience}\nGoal: Maximize ${inputs.goal}${tone ? `\nTone: ${tone}` : ''}\n\nFor each subject line, provide strictly these fields:\n- text\n- openRate (percent string like \'45%\')\n- trigger (e.g., Curiosity)\n- charCount (integer)\n\nReturn as a JSON array.`;
      break;
    case 'resume':
      prompt = `Generate ${Math.max(1, outputCount)} powerful resume bullet points based on:\nJob Title: ${inputs.jobTitle}\nAchievements: ${inputs.achievements}\nMetrics: ${inputs.metrics || 'N/A'}${tone ? `\nTone: ${tone}` : ''}\n\nReturn a JSON array of objects with fields:\n- text (the bullet text)\n- actionVerb (the leading action verb)\n- score (ATS fit score like '92/100').`;
      break;
    case 'cold_email':
      prompt = `Generate 3 personalized cold email variations for:\nProspect: ${inputs.prospectName}\nCompany: ${inputs.company}\nValue Proposition: ${inputs.valueProp || 'N/A'}\nPain Point: ${inputs.painPoint || 'N/A'}${tone ? `\nTone: ${tone}` : ''}\n\nProvide variations with hooks: Curiosity, Pain-Point, Value-First.\n\nFor each variation, return strictly these fields:\n- text\n- hook (Curiosity Hook | Pain-Point Hook | Value-First Hook)\n- tips (array of 3 short personalization tips)\n- followUps (array of 2 short follow-up templates)\n\nReturn a JSON array.`;
      break;
    case 'product_description':
      prompt = `Generate 3 product descriptions for:\nProduct: ${inputs.productName}\nFeatures: ${inputs.features}\nTarget Market: ${inputs.targetMarket}\nPrice Point: ${inputs.pricePoint}${tone ? `\nTone Preference: ${tone}` : ''}\nBullet Mode: ${inputs.bulletMode ? 'ON' : 'OFF'}\n\nReturn a JSON array of objects with fields:\n- text\n- tone (Casual & Friendly | Professional | Luxury Premium)\n- seoKeywords (array of ~5 SEO keywords)\n- metaDescription (concise 140-160 chars)\n- cta (short call-to-action)\n${inputs.bulletMode ? '- bullets (array of 5 concise bullet points for e-commerce listing)\n' : ''}`;
      break;
    case 'job_description':
      prompt = `Generate a complete job description for:\nRole Title: ${inputs.roleTitle}\nResponsibilities: ${inputs.responsibilities}\nCulture: ${inputs.culture || 'N/A'}\nExperience Level: ${inputs.experienceLevel}${tone ? `\nTone: ${tone}` : ''}\n\nReturn a single JSON object with strictly these fields:\n- roleSummary (string)\n- responsibilities (array of 5-8 bullet strings)\n- requiredQualifications (array of bullet strings)\n- niceToHave (array of bullet strings)\n- salaryRange (string)\n- culture (string)\n- eeoStatement (string)\n- complianceNotes (array of 3 short notes about inclusive/ADA/EEOC-friendly language)`;
      break;
    case 'linkedin':
    case 'linkedin_post':
      prompt = `Generate 3 LinkedIn post variations for:\nTopic: ${inputs.topic}\nIndustry: ${inputs.industry}\nTone: ${inputs.tone}${tone ? `\nTone Override: ${tone}` : ''}\n\nEach variation should include a strong hook, body, and CTA, and suggest hashtags.\nReturn a JSON array of objects with fields:\n- text\n- engagementScore (e.g., 'High', 'Very High', 'Medium-High')\n- hashtags (e.g., '#CareerAdvice #Tech')\n- emojiSuggestions (array of 3-6 relevant emojis).`;
      break;
    case 'social_ad':
      prompt = `Generate ${Math.max(1, outputCount)} short social media ad copies for:\nProduct/Service: ${inputs.productName}\nTarget Audience: ${inputs.audience}\nPlatform: ${inputs.platform}\nCampaign Goal: ${inputs.goal}${tone ? `\nTone: ${tone}` : ''}\n\nReturn a JSON array of objects with fields:\n- text\n- platform\n- predictedCtr (percent string like '3.2%')\n- trigger (FOMO | Social Proof | Curiosity | Urgency)\n- charCount (integer)`;
      break;
    case 'summarizer':
      prompt = `Condense the following text preserving key points.\nTone: ${inputs.tone}\nTarget length: ${inputs.length}\n\nText:\n${inputs.text}\n\nReturn a single JSON object with fields:\n- summary (string)\n- readability (e.g., '75/100' or 'Grade 8')\n- keyPoints (array of 3-6 short bullets)\n- keywords (array of ~5 SEO keywords)\n- readingTime (string like '35 sec')\n- timeSaved (string like '1m 25s saved')`;
      break;
    case 'cover_letter':
      prompt = `Write a professional cover letter (250-300 words).\nJob Title: ${inputs.jobTitle}\nCompany: ${inputs.company}\nKey Achievement: ${inputs.achievement}\nHiring Manager: ${inputs.hiringManager || 'N/A'}${tone ? `\nTone: ${tone}` : ''}\n\nReturn a single JSON object with fields:\n- text\n- atsScore (like '92/100')\n- openingHook (string)\n- closing (string)`;
      break;
    case 'twitter_thread':
      prompt = `Compose a Twitter/X thread.\nTopic: ${inputs.topic}\nAudience: ${inputs.audience}\nTone: ${inputs.tone}\nLength: ${inputs.length} tweets\n\nReturn a single JSON object with fields:\n- tweets (array of ${inputs.length || 5} strings, numbered appropriately)\n- engagementPrediction (string like 'Est. 450 likes, 120 reposts')\n- hashtags (string like '#growth #startups')`;
      break;
    case 'faq':
      prompt = `Generate an FAQ section.\nProduct/Service: ${inputs.productName}\nPain Points: ${inputs.painPoints}\nFeatures: ${inputs.features}\nFAQ Count: ${inputs.count || 10}${tone ? `\nTone: ${tone}` : ''}\n\nReturn a single JSON object with fields:\n- items (array of objects with {question, answer})\n- seoScore (like '8.5/10')\n- schemaMarkup (JSON-LD string for FAQPage)`;
      break;
    case 'script':
      prompt = `Write a script/voiceover.\nTopic: ${inputs.topic}\nDuration: ${inputs.duration}\nTone: ${inputs.tone}\nTarget Viewer: ${inputs.viewer}\n\nInclude pacing and clear [Action]/[Pause] markers with timestamps.\nReturn a single JSON object with fields:\n- segments (array of objects with {time, line})\n- pacingWpm (number)\n- wordCount (number)\n- readTime (string)`;
      break;
    case 'blog_helper':
      prompt = `You are an expert blog and article writing assistant.\nMode: ${inputs.mode} (one of: intro, outline, conclusion, section, paragraph, paragraph_expand, sentence_expand, article_expand, article_rewrite).\nTopic: ${inputs.topic}\nTarget audience: ${inputs.audience || 'general readers'}\nKeywords: ${inputs.keywords || 'none'}\nTone: ${inputs.tone || tone || 'neutral'}\nSource text (if provided for expand/rewrite modes): ${inputs.sourceText || 'N/A'}\n\nGenerate ${outputCount} variants appropriate for the selected mode.\nReturn a JSON array of objects with the following field:\n- text (the generated content as a string)`;
      break;
    case 'copy_helper':
      prompt = `You are an expert direct-response copywriter.\nMode: ${inputs.mode} (one of: aida, pas, pbs, sales_blurb, tagline).\nProduct or offer: ${inputs.product}\nAudience: ${inputs.audience || 'general audience'}\nOffer or main benefit: ${inputs.offer || 'N/A'}\nPain points to address: ${inputs.painPoints || 'N/A'}\nTone: ${inputs.tone || tone || 'neutral'}\n\nGenerate ${Math.max(1, outputCount)} short copy variations tailored to this mode.\nReturn a JSON array of objects with:\n- text (the copy as a single string)`;
      break;
    case 'social_helper':
      prompt = `You are a social media copywriter.\nMode: ${inputs.mode} (one of: post, caption, hook, hashtag_block, bio).\nPlatform: ${inputs.platform}\nTopic: ${inputs.topic}\nAudience: ${inputs.audience || 'general followers'}\nCTA or goal: ${inputs.cta || 'N/A'}\nTone: ${inputs.tone || tone || 'neutral'}\n\nGenerate ${Math.max(1, outputCount)} variations suitable for this platform and mode.\n\nFormatting rules (important):\n- Use plain text only.\n- Do not use markdown syntax (no *, **, bullet markers, or code fences).\n- Do not use emojis or emoji characters.\n- You may use normal sentences and line breaks.\n\nReturn a JSON array of objects with:\n- text (the post, caption, hook, hashtag block, or bio as a single string)`;
      break;
    case 'email_writer':
      prompt = `You are a helpful professional email writer.\nEmail type: ${inputs.emailType} (one of: follow_up, outreach, newsletter, professional, thank_you).\nRecipient: ${inputs.recipient || 'N/A'}\nSubject or topic: ${inputs.subject || inputs.topic || 'N/A'}\nContext / key details: ${inputs.context || 'N/A'}\nTone: ${inputs.tone || tone || 'professional'}\n\nWrite ${Math.max(1, outputCount)} concise email drafts (body only; you may include a clear subject line at the top if helpful).\nReturn a JSON array of objects with:\n- text (the full email content as a single string)`;
      break;
    case 'rewrite_helper':
      prompt = `You are an expert editor and rewriting assistant.\nMode: ${inputs.mode} (one of: rewrite, improve, simplify, formal, casual, shorten, expand, tone_change).\nTone: ${inputs.tone || tone || 'neutral'}\nTarget length: ${inputs.length || 'same'}\nExtra instructions: ${inputs.instructions || 'N/A'}\n\nOriginal text:\n${inputs.sourceText}\n\nRewrite the text according to the mode and instructions, generating ${Math.max(1, outputCount)} distinct variations.\nReturn a JSON array of objects with:\n- text (the rewritten text as a single string)`;
      break;
    case 'blog_post': {
      const isLong = inputs.length === 'long';
      const role = isLong
        ? 'You are an expert long-form blog writer. You write comprehensive, deep-dive articles.'
        : 'You are a professional blog writer.';
      const taskInstruction = isLong
        ? 'Write a complete, extensive blog article. Add detailed explanations, multiple examples, case studies, and practical applications in every section. The total word count must comfortably exceed 3000 words.'
        : 'Write a standard blog post. Aim for around 1500 words with clear headings.';
      prompt = `${role}\nTopic: ${inputs.topic}\nTarget audience: ${inputs.audience || 'general readers'}\nGoal: ${inputs.goal || 'educate and engage'}\nPrimary keyword: ${inputs.primaryKeyword || 'N/A'}\nSecondary keywords: ${inputs.secondaryKeywords || 'N/A'}\nOutline mode: ${inputs.outlineMode || 'auto'} (auto | custom)\nCustom outline (if any):\n${inputs.customOutline || 'N/A'}\nTarget length: ${inputs.length}\nTone: ${inputs.tone || tone || 'neutral'}\n\n${taskInstruction}\n\nFormatting rules (important):\n- Use plain text only.\n- Do not use markdown syntax (no *, **, bullet markers, or code fences).\n- Do not include markdown headings like #, ##, or code fences.\n- You may still use numbered lists like '1.' or '2.' when helpful.\n\nReturn a single JSON object with fields:\n- title\n- slug_suggestion\n- outline (array of heading strings)\n- body (full text as a single string)\n- meta_description`;
      break;
    }
    case 'article_from_outline': {
      const isArtLong = inputs.length === 'long';
      const artRole = isArtLong
        ? 'You are an expert long-form article writer. Expand the outline into a comprehensive deep-dive.'
        : 'You are an expert article writer.';
      const articleTaskInstruction = isArtLong
        ? 'Expand each outline point into multiple rich paragraphs with examples, data, and detailed explanations. The total word count must comfortably exceed 3000 words.'
        : 'Write a balanced article. The total word count should be around 1500 words.';
      prompt = `${artRole} Expand the provided outline.\nTitle or topic: ${inputs.topic}\nOutline:\n${inputs.outline}\nTarget audience: ${inputs.audience || 'general readers'}\nTarget length: ${inputs.length}\nTone: ${inputs.tone || tone || 'neutral'}\n\n${articleTaskInstruction}\n\nFormatting rules (important):\n- Use plain text only.\n- Do not use markdown syntax (no *, **, bullet markers, or code fences).\n- Do not include markdown headings like #, ##, or code fences.\n- You may still use numbered lists like '1.' or '2.' when helpful.\n\nReturn a single JSON object with fields:\n- title\n- outline (normalized array of headings)\n- body (full text as a single string)`;
      break;
    }
    case 'seo_blog_optimizer': {
      prompt = `You are an SEO expert and editor. Improve the following blog article for SEO and readability.\nPrimary keyword: ${inputs.primaryKeyword}\nSecondary keywords: ${inputs.secondaryKeywords || 'N/A'}\nGoal: ${inputs.goal || 'improve organic traffic and CTR'}\nTone: ${inputs.tone || tone || 'neutral'}\n\nOriginal article:\n${inputs.originalText}\n\nFormatting rules (important):\n- Use plain text only.\n- Do not use markdown syntax (no *, **, bullet markers, or code fences).\n- Do not include markdown headings like #, ##, or code fences.\n- You may still use numbered lists like '1.' or '2.' when helpful.\n\nReturn a single JSON object with fields:\n- optimized_title\n- optimized_meta_description\n- optimized_body\n- suggested_headings (array of strings)\n- keyword_usage_notes (array of short bullet strings)\n- improvements_summary (short paragraph)`;
      break;
    }
    case 'case_study_writer': {
      prompt = `You are a B2B case study writer. Create a compelling success story.\nClient name: ${inputs.clientName || 'N/A'}\nIndustry: ${inputs.industry || 'N/A'}\nProblem / challenge: ${inputs.problem}\nSolution summary: ${inputs.solution}\nKey results and metrics: ${inputs.results}\nTone: ${inputs.tone || tone || 'professional'}\n\nWrite a detailed narrative case study with clear section transitions.\n\nFormatting rules (important):\n- Use plain text only.\n- Do not use markdown syntax (no *, **, bullet markers, or code fences).\n- Do not include markdown headings like #, ##, or code fences.\n- You may still use numbered lists like '1.' or '2.' when listing results.\n\nReturn a single JSON object with fields:\n- headline\n- summary\n- background\n- challenge\n- solution\n- results\n- quote`;
      break;
    }
    case 'landing_page_writer': {
      prompt = `You are a conversion-focused landing page copywriter.\nProduct or offer: ${inputs.product}\nTarget audience: ${inputs.audience}\nMain benefit / promise: ${inputs.benefit}\nKey features: ${inputs.features}\nOffer and pricing: ${inputs.offer || 'N/A'}\nTone: ${inputs.tone || tone || 'persuasive'}\n\nWrite a full landing page including hero, social proof, benefits, and a closing section.\n\nFormatting rules (important):\n- Use plain text only.\n- Do not use markdown syntax (no *, **, bullet markers, or code fences).\n- Do not include markdown headings like #, ##, or code fences.\n- You may still use numbered lists like '1.' or '2.' when helpful.\n\nReturn a single JSON object with fields:\n- hero_headline\n- hero_subheadline\n- hero_cta\n- sections (array of { title, body })\n- faq_items (array of { question, answer })`;
      break;
    }
    case 'report_writer': {
      prompt = `You are a professional report/whitepaper writer. Draft a structured long-form report.\nTopic: ${inputs.topic}\nTarget audience: ${inputs.audience || 'executives'}\nKey points or thesis: ${inputs.keyPoints}\nDesired sections: ${inputs.sections || 'auto'}\nTone: ${inputs.tone || tone || 'formal'}\nTarget length: ${inputs.length || 'long'} (short ~1500 words, medium ~2500 words, long ~3000+ words; for long, write at least 2800 words)\n\nWrite a detailed report with multiple well-developed sections.\n\nFormatting rules (important):\n- Use plain text only.\n- Do not use markdown syntax (no *, **, bullet markers, or code fences).\n- Do not include markdown headings like #, ##, or code fences.\n- You may still use numbered lists like '1.' or '2.' when helpful.\n\nReturn a single JSON object with fields:\n- title\n- abstract\n- sections (array of { heading, body })`;
      break;
    }
    default:
      // Generic fallback for unmapped tools or custom tools
      prompt = `Act as a ${tool} generator.
      Inputs: ${JSON.stringify(inputs)}
      
      Instructions:
      - Generate content based on the inputs.
      - Return the result as a valid JSON object.
      - If the input includes long text (e.g. from a previous step), assume the goal is to process/rewrite it for this tool's format.`;
      break;
  }

  const result = await model.generateContent(prompt + "\n\nIMPORTANT: Return strictly valid JSON. Do not use Markdown code blocks.");
  const text = result.response.text();
  
  try {
    // removing markdown code fences if present
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    return formatResults(tool, parsed);
  } catch (e) {
    console.warn("[Workflow] JSON Parse failed", text.slice(0, 100));
    return { raw_text: text, error: "Model returned non-JSON" };
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
      return data;
    }
    case 'linkedin': 
    case 'linkedin_post': {
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
      return data;
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
      return data;
    }
    case 'twitter_thread': {
      if (data && typeof data === 'object') {
        return {
          tweets: Array.isArray(data?.tweets) ? data.tweets.map((t) => String(t)) : [],
          engagementPrediction: String(data?.engagementPrediction ?? ''),
          hashtags: String(data?.hashtags ?? ''),
        };
      }
      return data;
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
      return data;
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
      return data;
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
      return data;
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
      return data;
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
      return data;
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
      return data;
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
      return data;
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
      return data;
    }
    // For helpers (blog_helper, etc.), the default response is already mostly fine or complex to normalize perfectly here without bloating. 
    // I'll add a simple pass-through or basic string normalization if needed, but for now they return { text } mostly.
    case 'blog_helper':
    case 'copy_helper':
    case 'social_helper':
    case 'email_writer':
    case 'rewrite_helper':
        // Helpers usually return array of objects with text. 
        // Let's just ensure they are arrays.
        return Array.isArray(data) ? data : [data];
    default:
      return data;
  }
}
