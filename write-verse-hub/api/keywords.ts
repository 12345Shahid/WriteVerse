import { VercelRequest, VercelResponse } from '@vercel/node';

const SERPER_API_KEY = process.env.SERPER_API_KEY || '';

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

  if (!SERPER_API_KEY) {
    return res.status(500).json({ error: 'Serper API not configured' });
  }

  const { keyword } = req.body || {};
  if (!keyword) {
    return res.status(400).json({ error: 'Keyword is required' });
  }

  try {
    // Fetch keyword suggestions from Serper
    const autocompleteRes = await fetch('https://google.serper.dev/autocomplete', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: keyword })
    });

    const autocompleteData = await autocompleteRes.json();
    
    // Fetch related searches and People Also Ask
    const searchRes = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        q: keyword,
        num: 10 
      })
    });

    const searchData = await searchRes.json();

    // Process keyword suggestions with mock volume/difficulty data
    // In production, you'd use a proper keyword API like SEMrush/Ahrefs
    const keywords = (autocompleteData?.suggestions || []).slice(0, 10).map((s: any, i: number) => ({
      keyword: typeof s === 'string' ? s : s.value || s.text || String(s),
      volume: Math.floor(Math.random() * 10000) + 500, // Mock data
      difficulty: ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)],
      trend: ['up', 'stable', 'down'][Math.floor(Math.random() * 3)],
      cpc: Math.random() * 5 + 0.5
    }));

    // Extract People Also Ask questions
    const relatedQuestions = (searchData?.peopleAlsoAsk || []).map((q: any) => q.question || q);

    // Add related searches as additional keywords
    const relatedSearches = (searchData?.relatedSearches || []).map((s: any, i: number) => ({
      keyword: typeof s === 'string' ? s : s.query || String(s),
      volume: Math.floor(Math.random() * 5000) + 200,
      difficulty: ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)],
      trend: 'stable',
      cpc: Math.random() * 3 + 0.3
    }));

    res.json({
      keywords: [...keywords, ...relatedSearches],
      relatedQuestions,
      totalResults: searchData?.searchParameters?.totalResults || 0
    });
  } catch (err: any) {
    console.error('[API][keywords] Error:', err);
    res.status(500).json({ error: err.message });
  }
}
