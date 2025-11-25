import { GoogleGenerativeAI } from '@google/generative-ai';

function ok(res: any, body: any) { res.status(200).json(body); }
function bad(res: any, msg: string, code = 400) { res.status(code).json({ message: msg }); }

function fallbackResults(tool: string, inputs: any, n: number) {
  switch (tool) {
    case 'email_subject': {
      const topic = inputs?.topic || 'Your Topic';
      return Array.from({ length: n }).map((_, i) => {
        const text = `#${i + 1} ${topic} — unlock results today`;
        return { text, openRate: `${40 + (i % 5)}%`, trigger: ['Curiosity','Urgency','Social Proof','Scarcity','Benefit'][i%5], charCount: text.length };
      });
    }
    case 'resume': {
      return Array.from({ length: n }).map((_, i) => ({ actionVerb: 'Led', text: `Delivered measurable impact (${i+1})`, score: 90 - i }));
    }
    case 'cold_email': {
      return Array.from({ length: Math.min(3, n) }).map((_, i) => ({ hook: ['Curiosity','Pain-point','Value-first'][i], text: `Hi, here's a tailored note (${i+1}).` }));
    }
    case 'product_description': {
      const tones = ['Casual','Professional','Luxury'];
      return tones.slice(0, Math.min(3, n)).map((t) => ({ tone: t, text: `${t} description for your product.`, bullets: ['Feature 1','Benefit 2'], seoKeywords: ['keyword1','keyword2'], metaDescription: 'Great product', cta: 'Buy now' }));
    }
    case 'job_description': {
      return { roleSummary: 'Role summary here', responsibilities: ['Do X','Own Y'], requiredQualifications: ['Skill A','Skill B'], niceToHave: ['Nice 1'], salaryRange: '$60k-$80k', culture: 'Collaborative', eeoStatement: 'EOE' };
    }
    case 'linkedin': {
      return Array.from({ length: Math.min(3, n) }).map((_, i) => ({ text: `LinkedIn post variant ${i+1}`, engagementScore: 'High', hashtags: '#growth #ai' }));
    }
    case 'social_ad': {
      return Array.from({ length: Math.min(5, n) }).map((_, i) => ({ text: `Ad copy ${i+1}`, platform: ['Facebook','Instagram','TikTok'][i%3], predictedCtr: `${2+i*0.5}%`, trigger: 'FOMO', charCount: 80+i }));
    }
    case 'summarizer': {
      return { summary: 'Condensed summary', keyPoints: ['Point 1','Point 2'], readability: '75/100', readingTime: '35 sec', timeSaved: '1m 25s' };
    }
    case 'cover_letter': {
      return { text: 'Cover letter body ...', atsScore: 92, openingHook: 'Strong opening', closing: 'Sincerely' };
    }
    case 'twitter_thread': {
      return { tweets: ['Tweet 1','Tweet 2','Tweet 3'], engagementPrediction: '450 likes', hashtags: '#buildinpublic #ship' };
    }
    case 'faq': {
      return { items: [{ question: 'What is this?', answer: 'An AI writer.' }, { question: 'How much?', answer: '$9/mo' }] };
    }
    case 'script': {
      return { pacingWpm: 140, wordCount: 220, readTime: '1m 30s', segments: [{ time: '0:00', line: 'Hook' }, { time: '0:20', line: 'Body' }] };
    }
    default:
      return [];
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return bad(res, 'Method not allowed', 405);
  try {
    const { tool, inputs, outputCount = 3 } = req.body || {};
    if (!tool) return bad(res, 'Missing tool');

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    let results: any = null;

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });
        const prompt = `Tool: ${tool}. Inputs: ${JSON.stringify(inputs)}. Return ONLY JSON for the expected schema of this tool.`;
        const r = await model.generateContent(prompt);
        const text = r.response.text();
        try {
          const parsed = JSON.parse(text);
          results = parsed;
        } catch {
          results = fallbackResults(tool, inputs, outputCount);
        }
      } catch {
        results = fallbackResults(tool, inputs, outputCount);
      }
    } else {
      results = fallbackResults(tool, inputs, outputCount);
    }

    ok(res, { results });
  } catch (e: any) {
    bad(res, e?.message || 'Internal error', 500);
  }
}
