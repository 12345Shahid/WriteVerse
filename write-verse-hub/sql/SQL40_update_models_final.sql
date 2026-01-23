-- Update Available Models with Extended List (OpenAI o3/o4, GPT-5, Claude 4.5, etc.)

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

('openai/o3-deep-research', 'o3 Deep Research', 'openrouter', 'Premium', 128000, 8.0, 'Slow', 'Very High', 'Extensive research, deep analysis'),
('openai/o4-mini-deep-research', 'o4 Mini Deep Research', 'openrouter', 'Advanced', 128000, 2.5, 'Medium', 'Medium', 'Research on a budget'),
('openai/o3-pro', 'o3 Pro', 'openrouter', 'Premium', 128000, 6.0, 'Medium', 'High', 'Professional reasoning tasks'),
('openai/o4-mini-high', 'o4 Mini High', 'openrouter', 'Advanced', 128000, 1.5, 'Fast', 'Medium', 'High capability small model'),
('openai/o4-mini', 'o4 Mini', 'openrouter', 'Standard', 128000, 1.0, 'Very Fast', 'Low', 'Everyday reasoning'),
('openai/o3-mini-high', 'o3 Mini High', 'openrouter', 'Advanced', 128000, 2.0, 'Fast', 'Medium', 'Balanced reasoning'),
('openai/gpt-4o-2024-11-20', 'GPT-4o (Nov 2024)', 'openrouter', 'Premium', 128000, 3.0, 'Fast', 'High', 'Creative writing, latest capabilities'),
('openai/gpt-4o-mini', 'GPT-4o Mini', 'openrouter', 'Standard', 128000, 0.8, 'Very Fast', 'Low', 'Quick summaries, chat, edits'),

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

-- Gemini
('google/gemini-3-pro-preview', 'Gemini 3 Pro (Preview)', 'openrouter', 'Premium', 2000000, 3.0, 'Fast', 'High', 'Multimodal, frontier tasks'),
('google/gemini-2.5-pro', 'Gemini 2.5 Pro', 'openrouter', 'Premium', 2000000, 2.5, 'Fast', 'Medium', 'Deep reasoning, multimodal'),
('google/gemini-2.5-flash', 'Gemini 2.5 Flash', 'openrouter', 'Standard', 1000000, 1.0, 'Very Fast', 'Low', 'High volume, fast tasks'),
('google/gemini-2.0-flash-001', 'Gemini 2.0 Flash', 'openrouter', 'Standard', 1000000, 0.5, 'Very Fast', 'Very Low', 'Real-time generation');
