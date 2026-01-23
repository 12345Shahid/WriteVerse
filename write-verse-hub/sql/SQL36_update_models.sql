-- Add new metadata columns
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS category text DEFAULT 'Standard';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS speed text DEFAULT 'Medium';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS cost text DEFAULT 'Medium';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS best_for text DEFAULT '';

-- Clear old data
TRUNCATE TABLE public.ai_models;

-- Insert new models
INSERT INTO public.ai_models (id, name, provider, category, context_length, credit_multiplier, speed, cost, best_for) VALUES
('openai/gpt-4o', 'GPT-4o (Smartest)', 'openrouter', 'Premium', 128000, 3.0, 'Fast', 'High', 'Complex reasoning, coding, advanced writing'),
('openai/gpt-4o-mini', 'GPT-4o Mini (Fast)', 'openrouter', 'Standard', 128000, 1.0, 'Very Fast', 'Low', 'Quick summaries, chat, edits'),

('anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet', 'openrouter', 'Advanced', 200000, 1.5, 'Medium', 'Medium', 'Creative writing, coding, nuanced tone'),
('anthropic/claude-3-opus', 'Claude 3 Opus', 'openrouter', 'Premium', 200000, 7.5, 'Slow', 'Very High', 'Complex analysis, heavy reasoning'),

('google/gemini-pro-1.5', 'Gemini 1.5 Pro', 'openrouter', 'Advanced', 2000000, 2.0, 'Medium', 'Medium', 'Long documents, massive context analysis'),
('google/gemini-flash-1.5', 'Gemini 1.5 Flash', 'google', 'Standard', 1000000, 0.5, 'Very Fast', 'Very Low', 'Real-time generation, high volume');
