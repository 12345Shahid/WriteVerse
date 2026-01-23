import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './supabaseAdmin.js';

// Image generation endpoint using OpenRouter
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

// Credit cost per image generation (industry standard)
const IMAGE_CREDIT_COST = 5;

// Available image models (EXACT OpenRouter model IDs)
const IMAGE_MODELS: Record<string, string> = {
  'gemini-flash-image': 'google/gemini-2.5-flash-image-preview',   // Gemini 2.5 Flash (fastest, ~10s)
  'gemini-3-pro-image': 'google/gemini-3-pro-image-preview',       // Gemini 3 Pro (~15s)
  'flux-2-pro': 'black-forest-labs/flux.2-pro',                     // FLUX.2 Pro (~20-30s)
};

// Default to Gemini Flash Image (fastest and most reliable)
const DEFAULT_MODEL = 'google/gemini-2.5-flash-image-preview';

// More placeholder images for variety
const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=400&fit=crop&q=80', // tech
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop&q=80', // business
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=400&fit=crop&q=80', // office
  'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800&h=400&fit=crop&q=80', // writing
  'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=400&fit=crop&q=80', // teamwork
  'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&h=400&fit=crop&q=80', // laptop
  'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=400&fit=crop&q=80', // analytics
  'https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=800&h=400&fit=crop&q=80', // creative
  'https://images.unsplash.com/photo-1497215728101-856f4eb42e1c?w=800&h=400&fit=crop&q=80', // abstract
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=400&fit=crop&q=80', // meeting
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop&q=80', // data
  'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=400&fit=crop&q=80', // presentation
];

// Track last used index to avoid repeats
let lastUsedIndex = -1;

function getPlaceholderImage(): string {
  let index;
  do {
    index = Math.floor(Math.random() * PLACEHOLDER_IMAGES.length);
  } while (index === lastUsedIndex && PLACEHOLDER_IMAGES.length > 1);
  
  lastUsedIndex = index;
  return PLACEHOLDER_IMAGES[index];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!OPENROUTER_API_KEY) {
    console.error('[API][generate-image] OpenRouter API key not configured');
    return res.status(500).json({ error: 'Image generation not configured' });
  }

  const { prompt, sectionHeading, sectionContext, style = 'professional', model } = req.body || {};

  if (!prompt && !sectionHeading) {
    return res.status(400).json({ error: 'Prompt or section heading is required' });
  }

  // Get user and org IDs from headers
  const userId = req.headers['x-user-id'] as string;
  let orgId = req.headers['x-organization-id'] as string;

  // Initialize supabase admin
  const supabaseAdmin = getSupabaseAdmin();

  // Fallback if orgId is missing
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
        console.log('[API][generate-image] Fallback orgId found:', orgId);
      }
    } catch (err) {
      console.warn('[API][generate-image] Org fallback error:', err);
    }
  }

  // Check and deduct credits if we have org info
  let currentBalance = 0;
  if (supabaseAdmin && orgId) {
    const { data: creditsData } = await supabaseAdmin
      .from('organization_credits')
      .select('balance_credits')
      .eq('organization_id', orgId)
      .maybeSingle();

    currentBalance = creditsData?.balance_credits ?? 0;
    if (currentBalance < IMAGE_CREDIT_COST) {
      return res.status(402).json({
        error: 'INSUFFICIENT_CREDITS',
        message: 'Not enough credits to generate an image',
        debug: { required: IMAGE_CREDIT_COST, balance: currentBalance },
      });
    }
  }

  // Select model - use provided model or default to paid model
  const selectedModel = model && IMAGE_MODELS[model] ? IMAGE_MODELS[model] : DEFAULT_MODEL;
  const isOpenAIModel = selectedModel.startsWith('openai/');
  const isGeminiModel = selectedModel.startsWith('google/');

  // Construct image prompt - ALL models need explicit image generation instruction
  let imagePrompt: string;
  const basePrompt = prompt || sectionHeading || 'abstract art';
  
  // Use explicit image generation instruction for all models
  imagePrompt = `[IMAGE GENERATION REQUEST]
Generate a high-quality, detailed visual image for: "${basePrompt}"
Style: ${style || 'professional'}, modern, visually stunning

CRITICAL INSTRUCTIONS:
- Generate an actual IMAGE, not text
- Do NOT respond with text or explanations
- Do NOT ask clarifying questions
- Create a visual artwork directly
- Output format: image only

${sectionContext ? `Context for the image: ${sectionContext.substring(0, 200)}` : ''}`;

  console.log('[API][generate-image] Generating image:', {
    promptPreview: imagePrompt.substring(0, 100),
    style,
    model: selectedModel
  });

  try {
    // Use OpenRouter to generate image
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://writehubai.halal-solutions.com',
        'X-Title': 'WriteVerse Blog Studio'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          {
            role: 'user',
            content: imagePrompt
          }
        ],
        // Request image generation
        modalities: ['text', 'image'],
        // OpenAI GPT-5 needs high max_tokens for reasoning before image generation
        max_tokens: isOpenAIModel ? 16384 : 4096
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API][generate-image] OpenRouter error:', errorText);
      // Return placeholder instead of error
      const placeholderUrl = getPlaceholderImage();
      return res.json({
        success: true,
        imageUrl: placeholderUrl,
        prompt: imagePrompt,
        isPlaceholder: true
      });
    }

    const data = await response.json();
    
    // Log the full response for debugging
    console.log('[API][generate-image] Full OpenRouter response:', JSON.stringify(data, null, 2).substring(0, 2000));
    
    // Extract image from response
    const choice = data.choices?.[0];
    const message = choice?.message;
    const messageContent = message?.content;
    
    // Check if we got an image in the response
    let imageUrl = null;
    let imageBase64 = null;
    
    // FIRST: Check message.images array (this is where OpenRouter returns generated images!)
    if (message?.images && Array.isArray(message.images) && message.images.length > 0) {
      console.log('[API][generate-image] Found images array with', message.images.length, 'images');
      const firstImage = message.images[0];
      if (firstImage.type === 'image_url' && firstImage.image_url?.url) {
        imageUrl = firstImage.image_url.url;
        console.log('[API][generate-image] Extracted image from message.images, URL length:', imageUrl.length);
      }
    }
    
    // SECOND: Check if content is an array with image parts
    if (!imageUrl && !imageBase64 && Array.isArray(messageContent)) {
      for (const part of messageContent) {
        console.log('[API][generate-image] Part type:', part.type);
        if (part.type === 'image_url') {
          imageUrl = part.image_url?.url;
        } else if (part.type === 'image') {
          imageBase64 = part.image;
        }
      }
    }
    
    // THIRD: Check if content string contains a data URL
    if (!imageUrl && !imageBase64 && typeof messageContent === 'string') {
      const dataUrlMatch = messageContent.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
      if (dataUrlMatch) {
        imageUrl = dataUrlMatch[0];
        console.log('[API][generate-image] Extracted image from content string');
      }
    }

    // If no image was generated, return an error instead of placeholder
    if (!imageUrl && !imageBase64) {
      console.log('[API][generate-image] No AI image generated - returning error');
      return res.status(500).json({
        success: false,
        error: 'IMAGE_GENERATION_FAILED',
        message: 'The AI model did not generate an image. Please try again or select a different model (FLUX.2 Pro recommended).',
        model: selectedModel
      });
    }

    console.log('[API][generate-image] Success:', { hasUrl: !!imageUrl, hasBase64: !!imageBase64 });

    // Deduct credits after successful generation (requires orgId)
    if (supabaseAdmin && orgId) {
      const newBalance = Math.max(0, currentBalance - IMAGE_CREDIT_COST);
      await supabaseAdmin
        .from('organization_credits')
        .update({ balance_credits: newBalance })
        .eq('organization_id', orgId);
      
      console.log('[API][generate-image] Credits deducted', {
        orgId,
        oldBalance: currentBalance,
        newBalance,
        cost: IMAGE_CREDIT_COST,
      });
    }

    // Log to usage_events for analytics (works without orgId)
    if (supabaseAdmin && userId) {
      try {
        await supabaseAdmin
          .from('usage_events')
          .insert({
            user_id: userId,
            organization_id: orgId || null,
            tool: 'image-generator',
            credits: IMAGE_CREDIT_COST,
            metadata: { model: selectedModel, prompt: imagePrompt.substring(0, 100) },
          });
        console.log('[API][generate-image] Usage event logged');
      } catch (analyticsErr: any) {
        console.warn('[API][generate-image] Analytics log failed', analyticsErr);
      }
    }

    return res.json({
      success: true,
      imageUrl: imageUrl,
      imageBase64: imageBase64,
      prompt: imagePrompt,
      creditsCharged: IMAGE_CREDIT_COST
    });

  } catch (err: any) {
    console.error('[API][generate-image] Error:', err);
    return res.status(500).json({
      success: false,
      error: 'IMAGE_GENERATION_ERROR',
      message: err.message || 'Image generation failed. Please try again.',
      model: model || 'default'
    });
  }
}

