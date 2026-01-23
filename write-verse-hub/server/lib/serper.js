/**
 * Serper.dev API Integration
 * 
 * Provides keyword research and SERP analysis for SEO features.
 * Powers the Content Planner and keyword suggestions.
 * 
 * Setup:
 * 1. Get API key from serper.dev (free 2,500 queries)
 * 2. Add SERPER_API_KEY to .env
 * 
 * @see https://serper.dev/docs
 */
import 'dotenv/config';

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_BASE_URL = 'https://google.serper.dev';

const SERPER_ENABLED = !!SERPER_API_KEY;

/**
 * Check if Serper is available
 */
export function isSerperEnabled() {
    return SERPER_ENABLED;
}

/**
 * Search Google via Serper API
 * 
 * @param query - Search query
 * @param options - Search options (num, gl, hl, type)
 */
export async function search(query, options = {}) {
    if (!SERPER_ENABLED) {
        console.log('[Serper] Disabled - API key not configured');
        return { success: false, error: 'Serper not configured' };
    }

    try {
        console.log(`[Serper] Searching: "${query}"`);

        const response = await fetch(`${SERPER_BASE_URL}/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': SERPER_API_KEY
            },
            body: JSON.stringify({
                q: query,
                num: options.num || 10,
                gl: options.gl || 'us', // Country
                hl: options.hl || 'en', // Language
                type: options.type || 'search' // search, images, news, places
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[Serper] API error:', data);
            return { success: false, error: data.message || 'API error' };
        }

        console.log(`[Serper] Found ${data.organic?.length || 0} results`);
        
        return {
            success: true,
            organic: data.organic || [],
            peopleAlsoAsk: data.peopleAlsoAsk || [],
            relatedSearches: data.relatedSearches || [],
            searchInformation: data.searchInformation
        };
    } catch (error) {
        console.error('[Serper] Error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get keyword suggestions based on a seed keyword
 * Uses autocomplete and related searches
 * 
 * @param keyword - Seed keyword
 * @returns List of keyword suggestions
 */
export async function getKeywordSuggestions(keyword) {
    if (!SERPER_ENABLED) {
        return { success: false, error: 'Serper not configured' };
    }

    try {
        console.log(`[Serper] Getting suggestions for: "${keyword}"`);

        // Get autocomplete suggestions
        const autocompleteRes = await fetch(`${SERPER_BASE_URL}/autocomplete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': SERPER_API_KEY
            },
            body: JSON.stringify({ q: keyword })
        });

        const autocompleteData = await autocompleteRes.json();

        // Get related searches from regular search
        const searchRes = await search(keyword, { num: 10 });

        const suggestions = [
            ...(autocompleteData.suggestions || []).map(s => ({ keyword: s, source: 'autocomplete' })),
            ...(searchRes.relatedSearches || []).map(r => ({ keyword: r.query, source: 'related' })),
            ...(searchRes.peopleAlsoAsk || []).map(p => ({ keyword: p.question, source: 'paa' }))
        ];

        console.log(`[Serper] Found ${suggestions.length} keyword suggestions`);

        return {
            success: true,
            seed: keyword,
            suggestions: suggestions
        };
    } catch (error) {
        console.error('[Serper] Suggestions error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Analyze SERP for a keyword
 * Get competitor content and ranking factors
 * 
 * @param keyword - Target keyword
 */
export async function analyzeSERP(keyword) {
    if (!SERPER_ENABLED) {
        return { success: false, error: 'Serper not configured' };
    }

    try {
        console.log(`[Serper] Analyzing SERP for: "${keyword}"`);

        const result = await search(keyword, { num: 10 });

        if (!result.success) {
            return result;
        }

        // Extract useful data from top results
        const analysis = {
            keyword,
            totalResults: result.searchInformation?.totalResults,
            topResults: result.organic.slice(0, 5).map(r => ({
                title: r.title,
                link: r.link,
                snippet: r.snippet,
                position: r.position
            })),
            commonQuestions: result.peopleAlsoAsk?.slice(0, 5).map(p => p.question) || [],
            relatedKeywords: result.relatedSearches?.map(r => r.query) || [],
            
            // Content insights
            avgTitleLength: Math.round(
                result.organic.reduce((sum, r) => sum + (r.title?.length || 0), 0) / result.organic.length
            ),
            commonWords: extractCommonWords(result.organic.map(r => r.title + ' ' + r.snippet).join(' '))
        };

        console.log('[Serper] SERP analysis complete');
        return { success: true, analysis };
    } catch (error) {
        console.error('[Serper] SERP analysis error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Extract common words from text (simple frequency analysis)
 */
function extractCommonWords(text) {
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'it', 'its', 'you', 'your', 'we', 'our', 'they', 'their', 'i', 'my', 'me', 'he', 'she', 'him', 'her', 'his'];
    
    const words = text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.includes(w));
    
    const freq = {};
    words.forEach(w => freq[w] = (freq[w] || 0) + 1);
    
    return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));
}

/**
 * Get news results for a topic
 */
export async function getNews(topic, options = {}) {
    if (!SERPER_ENABLED) {
        return { success: false, error: 'Serper not configured' };
    }

    try {
        console.log(`[Serper] Getting news for: "${topic}"`);

        const response = await fetch(`${SERPER_BASE_URL}/news`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': SERPER_API_KEY
            },
            body: JSON.stringify({
                q: topic,
                num: options.num || 10,
                gl: options.gl || 'us'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.message || 'API error' };
        }

        return {
            success: true,
            news: data.news || []
        };
    } catch (error) {
        console.error('[Serper] News error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Health check
 */
export function healthCheck() {
    return {
        status: SERPER_ENABLED ? 'healthy' : 'disabled',
        enabled: SERPER_ENABLED,
        provider: 'Serper.dev',
        reason: SERPER_ENABLED ? undefined : 'SERPER_API_KEY not set'
    };
}
