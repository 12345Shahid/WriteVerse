import { VercelRequest, VercelResponse } from '@vercel/node';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = 'google/gemini-2.0-flash-001';

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
}

// Calculate burstiness (sentence length variation)
function calculateBurstiness(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length < 2) return 0.5;
  
  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  
  // Coefficient of variation (higher = more human-like)
  const cv = mean > 0 ? stdDev / mean : 0;
  
  // Normalize to 0-1 scale (0.3+ is typically human)
  return Math.min(cv / 0.6, 1);
}

// Analyze vocabulary diversity
function analyzeVocabulary(text: string): number {
  const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
  if (words.length < 10) return 0.5;
  
  const uniqueWords = new Set(words);
  const ratio = uniqueWords.size / words.length;
  
  // Higher ratio = more diverse = more human-like
  return Math.min(ratio * 2, 1);
}

// Check for AI patterns
function detectAIPatterns(text: string): number {
  const patterns = [
    /\bIn conclusion\b/gi,
    /\bIt is important to note\b/gi,
    /\bFurthermore\b/gi,
    /\bAdditionally\b/gi,
    /\bMoreover\b/gi,
    /\bIn summary\b/gi,
    /\bTo summarize\b/gi,
    /\bAs an AI\b/gi,
    /\bI don't have personal\b/gi,
    /\bI cannot\b/gi,
    /\bIt's worth noting\b/gi,
    /\bThis is because\b/gi,
  ];
  
  let matches = 0;
  for (const pattern of patterns) {
    const found = text.match(pattern);
    if (found) matches += found.length;
  }
  
  // More pattern matches = more AI-like
  const score = Math.min(matches / 5, 1);
  return 1 - score; // Invert so higher = more human
}

// Use LLM to assess perplexity-like characteristics
async function assessWithLLM(text: string): Promise<{score: number, reasoning: string}> {
  if (!OPENROUTER_API_KEY) {
    return { score: 0.5, reasoning: 'API key not configured' };
  }

  const prompt = `Analyze this text and determine if it was written by AI or a human.

Text to analyze:
"""
${text.slice(0, 2000)}
"""

Evaluate based on:
1. Sentence structure variety
2. Vocabulary naturalness
3. Presence of filler words, contractions, casual language
4. Logical flow and transitions
5. Unique perspectives or opinions

Respond in this exact JSON format only:
{"ai_probability": 0.XX, "reasoning": "Brief explanation"}

Where ai_probability is 0.0 (definitely human) to 1.0 (definitely AI).`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://writerai.app',
        'X-Title': 'WriterAI Detector',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      return { score: 0.5, reasoning: 'LLM analysis failed' };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: 1 - (parsed.ai_probability || 0.5), // Invert so higher = more human
        reasoning: parsed.reasoning || 'Analysis complete'
      };
    }
    
    return { score: 0.5, reasoning: 'Could not parse LLM response' };
  } catch (e: any) {
    console.error('[AI Detect] LLM error:', e);
    return { score: 0.5, reasoning: 'Error during analysis' };
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

  const { text } = req.body || {};

  if (!text || typeof text !== 'string' || text.trim().length < 50) {
    return res.status(400).json({ error: 'Text must be at least 50 characters' });
  }

  try {
    console.log('[AI Detect] Analyzing text of length:', text.length);

    // Run all analyses
    const burstiness = calculateBurstiness(text);
    const vocabulary = analyzeVocabulary(text);
    const patterns = detectAIPatterns(text);
    const llmAnalysis = await assessWithLLM(text);

    // Calculate weighted score
    // Higher score = more human-like
    const humanScore = (
      burstiness * 0.2 +
      vocabulary * 0.15 +
      patterns * 0.15 +
      llmAnalysis.score * 0.5
    );

    // Determine verdict
    let verdict: string;
    if (humanScore >= 0.7) {
      verdict = 'Likely Human Written';
    } else if (humanScore >= 0.4) {
      verdict = 'Mixed/Uncertain';
    } else {
      verdict = 'Likely AI Generated';
    }

    console.log('[AI Detect] Score:', humanScore, 'Verdict:', verdict);

    res.json({
      humanScore: Math.round(humanScore * 100),
      aiScore: Math.round((1 - humanScore) * 100),
      verdict,
      breakdown: {
        burstiness: Math.round(burstiness * 100),
        vocabulary: Math.round(vocabulary * 100),
        patterns: Math.round(patterns * 100),
        llmAnalysis: Math.round(llmAnalysis.score * 100)
      },
      reasoning: llmAnalysis.reasoning
    });
  } catch (e: any) {
    console.error('[AI Detect] Error:', e);
    res.status(500).json({ error: e.message });
  }
}
