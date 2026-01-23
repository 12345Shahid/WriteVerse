import { getSupabaseAdmin } from './supabaseAdmin.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = 'google/gemini-2.0-flash-001';

// Credit cost for template generation
const TEMPLATE_CREDIT_COST = 3;

// Strip markdown formatting from text
function stripMarkdown(text: string): string {
  if (!text) return '';
  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove bold/italic markers
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remove headers
    .replace(/^#+\s*/gm, '')
    // Remove horizontal rules
    .replace(/^---+$/gm, '')
    .replace(/^\*\*\*+$/gm, '')
    // Remove bullet points but keep content
    .replace(/^[\s]*[-*]\s+/gm, '')
    // Remove blockquotes
    .replace(/^>\s*/gm, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server misconfigured' });

  const userId = req.headers['x-user-id'];
  const orgId = req.headers['x-organization-id'];

  if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

  const { templateId, inputs, brandVoiceId } = req.body;

  if (!templateId || !inputs) {
    return res.status(400).json({ error: 'Missing templateId or inputs' });
  }

  try {
    // 1. Fetch the template
    const { data: template, error: templateError } = await supabaseAdmin
      .from('content_templates')
      .select('*')
      .eq('id', templateId)
      .eq('organization_id', orgId)
      .single();

    if (templateError || !template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // 2. Check organization credits
    const { data: creditsData } = await supabaseAdmin
      .from('organization_credits')
      .select('balance_credits')
      .eq('organization_id', orgId)
      .maybeSingle();

    const currentBalance = creditsData?.balance_credits ?? 0;
    if (currentBalance < TEMPLATE_CREDIT_COST) {
      return res.status(402).json({
        error: 'INSUFFICIENT_CREDITS',
        message: 'Not enough credits to run this template',
        debug: { required: TEMPLATE_CREDIT_COST, balance: currentBalance },
      });
    }

    // 3. Fetch brand voice if provided
    let brandContext = '';
    if (brandVoiceId) {
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
        console.warn('[API][generate-template] Failed to fetch brand voice', e);
      }
    }

    console.log('[API][generate-template] Brand voice check', {
      brandVoiceId: brandVoiceId || 'none',
      hasBrandContext: brandContext.length > 0,
    });

    // 4. Build prompt by replacing placeholders in prompt_text
    let prompt = template.prompt_text;
    
    // Replace {key} placeholders with input values
    for (const [key, value] of Object.entries(inputs)) {
      const regex = new RegExp(`\\{${key}\\}`, 'gi');
      prompt = prompt.replace(regex, String(value || ''));
    }

    // Add brand context and instruction to not use markdown
    const finalPrompt = `${prompt}${brandContext}\n\nIMPORTANT: Write your response as plain text WITHOUT any markdown formatting. Do not use asterisks, headers, bullet points, or code blocks. Write naturally flowing text.`;

    // 5. Call OpenRouter to generate content
    const systemPrompt = brandContext ? 
      `You are a professional content writer. Generate high-quality content based on the user's request. Be creative, engaging, and professional. IMPORTANT: Follow the brand voice instructions carefully. Do NOT use any markdown formatting in your response - write plain text only.` :
      `You are a professional content writer. Generate high-quality content based on the user's request. Be creative, engaging, and professional. Do NOT use any markdown formatting in your response - write plain text only.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://writerai.app',
        'X-Title': 'WriterAI Template Generator',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: finalPrompt },
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API][generate-template] OpenRouter error', response.status, errorText);
      throw new Error(`Generation failed: ${response.status}`);
    }

    const data = await response.json();
    let generatedText = data.choices?.[0]?.message?.content || '';
    
    // Strip any remaining markdown formatting
    generatedText = stripMarkdown(generatedText);

    // 5. Deduct credits
    const newBalance = Math.max(0, currentBalance - TEMPLATE_CREDIT_COST);
    await supabaseAdmin
      .from('organization_credits')
      .update({ balance_credits: newBalance })
      .eq('organization_id', orgId);
    
    console.log('[API][generate-template] Credits deducted', {
      orgId,
      oldBalance: currentBalance,
      newBalance,
      cost: TEMPLATE_CREDIT_COST,
    });

    // 6. Log to usage_events for analytics
    try {
      await supabaseAdmin
        .from('usage_events')
        .insert({
          user_id: userId,
          organization_id: orgId,
          tool: `template:${template.name}`,
          credits: TEMPLATE_CREDIT_COST,
          metadata: { templateId, inputs: Object.keys(inputs) },
        });
      console.log('[API][generate-template] Usage event logged to analytics');
    } catch (analyticsErr: any) {
      console.warn('[API][generate-template] Analytics log failed', analyticsErr);
    }

    // 7. Save result to saved_results table
    const { data: result, error: resultError } = await supabaseAdmin
      .from('saved_results')
      .insert({
        organization_id: orgId,
        user_id: userId,
        tool_name: `template:${template.name}`,
        input_data: inputs,
        results: [{ text: generatedText }],
      })
      .select()
      .single();

    if (resultError) {
      console.warn('[API][generate-template] Failed to save result', resultError);
    }

    return res.json({
      results: [{
        text: generatedText,
        id: result?.id || null,
      }],
      debug: {
        creditsCharged: TEMPLATE_CREDIT_COST,
        newBalance,
      },
    });

  } catch (err: any) {
    console.error('[API][generate-template] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
}
