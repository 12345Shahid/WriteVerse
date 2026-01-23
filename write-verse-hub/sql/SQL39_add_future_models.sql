-- Update Available Models with Extended List (GPT-5, Claude 4.5, etc.)

-- Add new metadata columns if missing
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS category text DEFAULT 'Standard';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS speed text DEFAULT 'Medium';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS cost text DEFAULT 'Medium';
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS best_for text DEFAULT '';

-- Clear old data
TRUNCATE TABLE public.ai_models;

-- Insert New Models
INSERT INTO public.ai_models (id, name, provider, category, context_length, credit_multiplier, speed, cost, best_for) VALUES
-- OpenAI
('openai/gpt-5.1', 'GPT-5.1 (Frontier)', 'openrouter', 'Premium', 128000, 6.0, 'Fast', 'High', 'Complex reasoning, advanced creation'),
('openai/gpt-5.1-chat', 'GPT-5.1 Chat', 'openrouter', 'Advanced', 128000, 3.0, 'Very Fast', 'Medium', 'Interactive chat, high throughput'),
('openai/gpt-5-pro', 'GPT-5 Pro', 'openrouter', 'Premium', 128000, 5.0, 'Medium', 'High', 'Deep reasoning, critical tasks'),
('openai/gpt-5', 'GPT-5', 'openrouter', 'Premium', 128000, 4.0, 'Fast', 'High', 'General purpose advanced tasks'),
('openai/gpt-5-mini', 'GPT-5 Mini', 'openrouter', 'Standard', 128000, 1.0, 'Very Fast', 'Low', 'Quick tasks, cost effective'),
('openai/gpt-5-nano', 'GPT-5 Nano', 'openrouter', 'Standard', 128000, 0.5, 'Ultra Fast', 'Very Low', 'Real-time, edge cases'),
('openai/gpt-4.1', 'GPT-4.1', 'openrouter', 'Advanced', 128000, 2.0, 'Fast', 'Medium', 'Reliable reasoning'),
('openai/gpt-4.1-mini', 'GPT-4.1 Mini', 'openrouter', 'Standard', 128000, 0.8, 'Very Fast', 'Low', 'General lightweight tasks'),
('openai/gpt-4.1-nano', 'GPT-4.1 Nano', 'openrouter', 'Standard', 128000, 0.4, 'Ultra Fast', 'Very Low', 'Fastest responses'),

-- Anthropic
('anthropic/claude-opus-4.5', 'Claude 4.5 Opus', 'openrouter', 'Premium', 200000, 8.0, 'Slow', 'Very High', 'Maximum intelligence, heavy research'),
('anthropic/claude-sonnet-4.5', 'Claude 4.5 Sonnet', 'openrouter', 'Advanced', 200000, 3.0, 'Medium', 'High', 'Coding, nuanced writing'),
('anthropic/claude-haiku-4.5', 'Claude 4.5 Haiku', 'openrouter', 'Standard', 200000, 1.0, 'Fast', 'Low', 'Fast, smart interactions'),
('anthropic/claude-opus-4.1', 'Claude 4.1 Opus', 'openrouter', 'Premium', 200000, 6.0, 'Slow', 'High', 'Deep analysis'),
('anthropic/claude-opus-4', 'Claude 4 Opus', 'openrouter', 'Premium', 200000, 5.0, 'Slow', 'High', 'Complex reasoning'),
('anthropic/claude-sonnet-4-0', 'Claude 4 Sonnet', 'openrouter', 'Advanced', 200000, 2.0, 'Medium', 'Medium', 'Daily driver, coding'),
('anthropic/claude-3.7-sonnet', 'Claude 3.7 Sonnet', 'openrouter', 'Advanced', 200000, 1.5, 'Medium', 'Medium', 'High quality writing'),
('anthropic/claude-3.7-sonnet:thinking', 'Claude 3.7 Sonnet (Thinking)', 'openrouter', 'Advanced', 200000, 1.5, 'Slow', 'Medium', 'Extended reasoning'),
('anthropic/claude-3.5-haiku-20241022', 'Claude 3.5 Haiku', 'openrouter', 'Standard', 200000, 0.5, 'Very Fast', 'Low', 'Speed and efficiency'),

-- Gemini
('google/gemini-3-pro-preview', 'Gemini 3 Pro (Preview)', 'openrouter', 'Premium', 2000000, 3.0, 'Fast', 'High', 'Multimodal, frontier tasks'),
('google/gemini-2.5-pro', 'Gemini 2.5 Pro', 'openrouter', 'Premium', 2000000, 2.5, 'Fast', 'Medium', 'Deep reasoning, multimodal'),
('google/gemini-2.5-flash', 'Gemini 2.5 Flash', 'openrouter', 'Standard', 1000000, 1.0, 'Very Fast', 'Low', 'High volume, fast tasks'),
('google/gemini-2.0-flash-001', 'Gemini 2.0 Flash', 'openrouter', 'Standard', 1000000, 0.5, 'Very Fast', 'Very Low', 'Real-time generation');
