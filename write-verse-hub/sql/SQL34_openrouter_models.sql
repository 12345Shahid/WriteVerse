-- Models Configuration Table
CREATE TABLE IF NOT EXISTS public.ai_models (
    id text PRIMARY KEY, -- e.g. 'openai/gpt-4o'
    name text NOT NULL,
    provider text NOT NULL DEFAULT 'openrouter', -- 'openrouter', 'google'
    context_length int DEFAULT 4096,
    credit_multiplier numeric(10, 2) DEFAULT 1.0, -- 1.0 = standard cost, 2.0 = double cost
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;

-- Everyone can read active models
CREATE POLICY "Everyone can view active models" ON public.ai_models
    FOR SELECT USING (is_active = true);

-- Only admins can modify (assuming you have admin policies, otherwise manual insert)

-- Seed Initial Data (OpenRouter Models)
INSERT INTO public.ai_models (id, name, provider, context_length, credit_multiplier) VALUES
('google/gemini-2.0-flash-exp:free', 'Gemini 2.0 Flash (Free)', 'openrouter', 32000, 0.5),
('openai/gpt-4o', 'GPT-4o', 'openrouter', 128000, 10.0),
('openai/gpt-4o-mini', 'GPT-4o Mini', 'openrouter', 128000, 1.0),
('anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet', 'openrouter', 200000, 5.0),
('meta-llama/llama-3.1-70b-instruct', 'Llama 3.1 70B', 'openrouter', 128000, 1.5),
('mistralai/mistral-large', 'Mistral Large', 'openrouter', 32000, 3.0)
ON CONFLICT (id) DO UPDATE 
SET credit_multiplier = EXCLUDED.credit_multiplier;
