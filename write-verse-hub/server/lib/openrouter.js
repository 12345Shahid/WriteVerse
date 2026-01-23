const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export class OpenRouterClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    getGenerativeModel({ model }) {
        return new OpenRouterModel(this.apiKey, model);
    }
}

class OpenRouterModel {
    constructor(apiKey, modelId) {
        this.apiKey = apiKey;
        this.modelId = modelId;
    }

    /**
     * Generate content compatible with Google Generative AI interface
     * @param {string|object} request - Prompt string or config object
     */
    async generateContent(request) {
        let messages = [];
        
        // Normalize Input
        if (typeof request === 'string') {
            messages.push({ role: 'user', content: request });
        } else if (request.contents) {
            // Convert Google format (contents: [{ role, parts: [{text}] }]) to OpenAI format
            messages = request.contents.map(c => ({
                role: c.role === 'model' ? 'assistant' : c.role,
                content: c.parts.map(p => p.text).join('')
            }));
        }

        // Extract Config
        const config = request.generationConfig || {};
        
        try {
            const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': 'https://writerai.app', // Required by OpenRouter
                    'X-Title': 'WriterAI',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.modelId,
                    messages: messages,
                    max_tokens: config.maxOutputTokens || 4096,
                    temperature: config.temperature || 0.7,
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`OpenRouter API Error (${response.status}): ${errText}`);
            }

            const data = await response.json();
            
            if (!data.choices || data.choices.length === 0) {
                throw new Error('No content generated');
            }

            const content = data.choices[0].message.content;

            // Return object matching Google's response structure
            return {
                response: {
                    text: () => content
                }
            };

        } catch (error) {
            console.error('[OpenRouter] Generation failed:', error);
            throw error;
        }
    }
}
