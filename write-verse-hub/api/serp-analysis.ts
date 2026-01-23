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
    // Fetch SERP results from Serper
    const searchRes = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        q: keyword,
        num: 10,
        gl: 'us',
        hl: 'en'
      })
    });

    const searchData = await searchRes.json();

    // Process organic results
    const results = (searchData?.organic || []).slice(0, 10).map((r: any, i: number) => ({
      position: r.position || i + 1,
      title: r.title || 'No title',
      link: r.link || '',
      snippet: r.snippet || '',
      domain: r.domain || new URL(r.link || 'https://example.com').hostname
    }));

    // Extract featured snippet if any
    const featuredSnippet = searchData?.answerBox ? {
      title: searchData.answerBox.title,
      snippet: searchData.answerBox.snippet || searchData.answerBox.answer,
      link: searchData.answerBox.link
    } : null;

    // People Also Ask
    const peopleAlsoAsk = (searchData?.peopleAlsoAsk || []).map((q: any) => ({
      question: q.question,
      snippet: q.snippet,
      link: q.link
    }));

    res.json({
      results,
      featuredSnippet,
      peopleAlsoAsk,
      totalResults: searchData?.searchParameters?.totalResults || 0,
      searchTime: searchData?.searchParameters?.timeElapsed || null
    });
  } catch (err: any) {
    console.error('[API][serp-analysis] Error:', err);
    res.status(500).json({ error: err.message });
  }
}
