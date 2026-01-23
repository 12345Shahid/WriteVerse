import { VercelRequest, VercelResponse } from '@vercel/node';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = 'google/gemini-2.0-flash-001';

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
}

// Style prompts for different writing styles
const STYLE_PROMPTS: Record<string, string> = {
  standard: `Rewrite this text to sound more natural and human-like. Use varied sentence lengths, 
casual language where appropriate, contractions, and add personality.`,
  
  academic: `Rewrite this text in an academic style. Use formal vocabulary, proper citations format awareness, 
scholarly tone, but still vary sentence structures to appear naturally written by a student or researcher.`,
  
  simple: `Rewrite this text using simple, easy-to-understand language. Use short sentences, 
common words, and a conversational tone. Make it accessible to a general audience.`,
  
  formal: `Rewrite this text in a professional, formal style. Use proper grammar, 
avoid contractions, maintain a serious tone, but still include natural human variations.`,
  
  creative: `Rewrite this text with more creativity and flair. Add vivid descriptions, 
metaphors where appropriate, and make it engaging while keeping the core message.`,
};

// Apply freeze list - protect certain words from modification
function applyFreezeList(text: string, freezeList: string[]): { text: string; tokens: Map<string, string> } {
  const tokens = new Map<string, string>();
  let modifiedText = text;
  
  freezeList.forEach((word, index) => {
    const token = `__FREEZE_${index}__`;
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    modifiedText = modifiedText.replace(regex, token);
    tokens.set(token, word);
  });
  
  return { text: modifiedText, tokens };
}

// Restore frozen words
function restoreFreezeList(text: string, tokens: Map<string, string>): string {
  let restoredText = text;
  tokens.forEach((originalWord, token) => {
    restoredText = restoredText.replace(new RegExp(token, 'g'), originalWord);
  });
  return restoredText;
}

// Humanize text using LLM
async function humanizeText(
  text: string, 
  style: string,
  freezeList: string[]
): Promise<{ result: string; success: boolean; error?: string }> {
  if (!OPENROUTER_API_KEY) {
    return { result: '', success: false, error: 'API key not configured' };
  }

  // Apply freeze list
  const { text: processedText, tokens } = applyFreezeList(text, freezeList);
  
  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.standard;
  
  const prompt = `${stylePrompt}

IMPORTANT RULES:
1. Keep the same meaning and key information
2. Vary sentence lengths naturally (mix short and long)
3. Add occasional filler words or natural pauses
4. Use contractions where appropriate (for non-formal styles)
5. Maintain any tokens that look like __FREEZE_X__ exactly as they are
6. Do NOT add any introduction or explanation - just output the rewritten text
7. Make it pass AI detection by sounding genuinely human

Original text:
"""
${processedText}
"""

Rewritten text:`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://writerai.app',
        'X-Title': 'WriterAI Humanizer',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: Math.min(text.length * 2, 4000),
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { result: '', success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    let result = data.choices?.[0]?.message?.content || '';
    
    // Remove any markdown formatting or quotes added by the model
    result = result.replace(/^["']|["']$/g, '').trim();
    result = result.replace(/^```[\s\S]*?```$/gm, '').trim();
    
    // Restore frozen words
    result = restoreFreezeList(result, tokens);
    
    return { result, success: true };
  } catch (e: any) {
    console.error('[Humanize] Error:', e);
    return { result: '', success: false, error: e.message };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const { text, style = 'standard', freezeList = [] } = req.body || {};

  if (!text || typeof text !== 'string' || text.trim().length < 20) {
    return res.status(400).json({ error: 'Text must be at least 20 characters' });
  }

  if (!STYLE_PROMPTS[style]) {
    return res.status(400).json({ 
      error: 'Invalid style', 
      validStyles: Object.keys(STYLE_PROMPTS) 
    });
  }

  try {
    console.log('[Humanize] Processing text of length:', text.length, 'Style:', style);
    console.log('[Humanize] Freeze list:', freezeList);

    const { result, success, error } = await humanizeText(text, style, freezeList);

    if (!success) {
      return res.status(500).json({ error: error || 'Humanization failed' });
    }

    console.log('[Humanize] Success, output length:', result.length);

    res.json({
      original: text,
      humanized: result,
      style,
      wordCountOriginal: text.split(/\s+/).length,
      wordCountHumanized: result.split(/\s+/).length,
      frozenWords: freezeList
    });
  } catch (e: any) {
    console.error('[Humanize] Error:', e);
    res.status(500).json({ error: e.message });
  }
}
