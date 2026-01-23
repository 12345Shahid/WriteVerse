/**
 * AI Humanizer Integration
 * 
 * Uses Undetectable.ai API to convert AI-generated text into human-like prose.
 * This powers the "Natural Write" mode which costs extra credits.
 * 
 * Setup:
 * 1. Get API key from undetectable.ai
 * 2. Add UNDETECTABLE_API_KEY to .env
 * 
 * @see https://undetectable.ai/api.html
 */
import 'dotenv/config';

const UNDETECTABLE_API_KEY = process.env.UNDETECTABLE_API_KEY;
const UNDETECTABLE_API_URL = 'https://api.undetectable.ai/submit';

const HUMANIZER_ENABLED = !!UNDETECTABLE_API_KEY;

/**
 * Check if humanizer is available
 */
export function isHumanizerEnabled() {
    return HUMANIZER_ENABLED;
}

/**
 * Humanize AI-generated text using Undetectable.ai
 * 
 * @param text - The AI-generated text to humanize
 * @param options - Configuration options
 * @returns Humanized text or original if failed
 */
export async function humanizeText(text, options = {}) {
    if (!HUMANIZER_ENABLED) {
        console.log('[Humanizer] Disabled - API key not configured');
        return { success: false, error: 'Humanizer not configured', original: text };
    }

    if (!text || text.length < 50) {
        console.log('[Humanizer] Text too short to humanize');
        return { success: false, error: 'Text too short (min 50 chars)', original: text };
    }

    try {
        console.log(`[Humanizer] Processing ${text.length} characters`);

        const response = await fetch(UNDETECTABLE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': UNDETECTABLE_API_KEY
            },
            body: JSON.stringify({
                content: text,
                readability: options.readability || 'High School', // Options: 'High School', 'University', 'Doctorate', 'Journalist', 'Marketing'
                purpose: options.purpose || 'General Writing', // Options: 'General Writing', 'Essay', 'Article', 'Marketing Material', 'Story', 'Cover letter', 'Report', 'Business Material', 'Legal Material'
                strength: options.strength || 'More Human' // Options: 'Quality', 'Balanced', 'More Human'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[Humanizer] API error:', data);
            return { 
                success: false, 
                error: data.message || 'API error', 
                original: text 
            };
        }

        // Undetectable.ai returns async job - need to poll for result
        if (data.id) {
            console.log(`[Humanizer] Job submitted: ${data.id}`);
            
            // Poll for result (max 30 seconds)
            const result = await pollForResult(data.id);
            
            if (result.output) {
                console.log(`[Humanizer] Success - output: ${result.output.length} chars`);
                return {
                    success: true,
                    humanized: result.output,
                    original: text,
                    aiScore: result.ai_score,
                    jobId: data.id
                };
            } else {
                return { success: false, error: 'No output received', original: text };
            }
        }

        // Direct response (if API changed)
        if (data.output) {
            return {
                success: true,
                humanized: data.output,
                original: text,
                aiScore: data.ai_score
            };
        }

        return { success: false, error: 'Unexpected response', original: text };

    } catch (error) {
        console.error('[Humanizer] Error:', error.message);
        return { 
            success: false, 
            error: error.message, 
            original: text 
        };
    }
}

/**
 * Poll for result from Undetectable.ai async job
 */
async function pollForResult(jobId, maxAttempts = 10) {
    const pollUrl = `https://api.undetectable.ai/document`;
    
    for (let i = 0; i < maxAttempts; i++) {
        await sleep(3000); // Wait 3 seconds between polls
        
        try {
            const response = await fetch(pollUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': UNDETECTABLE_API_KEY
                },
                body: JSON.stringify({ id: jobId })
            });

            const data = await response.json();

            if (data.status === 'done' && data.output) {
                return data;
            }

            if (data.status === 'failed') {
                console.error('[Humanizer] Job failed:', data);
                return { error: 'Job failed' };
            }

            console.log(`[Humanizer] Polling attempt ${i + 1}/${maxAttempts} - status: ${data.status}`);
        } catch (e) {
            console.error('[Humanizer] Poll error:', e.message);
        }
    }

    return { error: 'Polling timeout' };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check AI detection score of text
 * Uses Undetectable.ai's detection feature
 * 
 * @param text - Text to analyze
 * @returns AI detection score (0-100, higher = more AI-like)
 */
export async function checkAIScore(text) {
    if (!HUMANIZER_ENABLED) {
        return { success: false, error: 'Not configured' };
    }

    try {
        console.log('[Humanizer] Checking AI score...');

        const response = await fetch('https://api.undetectable.ai/detect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': UNDETECTABLE_API_KEY
            },
            body: JSON.stringify({ content: text })
        });

        const data = await response.json();

        if (data.score !== undefined) {
            console.log(`[Humanizer] AI score: ${data.score}`);
            return {
                success: true,
                score: data.score,
                isAI: data.score > 50
            };
        }

        return { success: false, error: 'No score returned' };
    } catch (error) {
        console.error('[Humanizer] AI check error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Health check for humanizer service
 */
export function healthCheck() {
    return {
        status: HUMANIZER_ENABLED ? 'healthy' : 'disabled',
        enabled: HUMANIZER_ENABLED,
        provider: 'Undetectable.ai',
        reason: HUMANIZER_ENABLED ? undefined : 'UNDETECTABLE_API_KEY not set'
    };
}
