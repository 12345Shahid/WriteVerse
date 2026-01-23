import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export const AVAILABLE_MODELS = [
  // OpenAI (New & Existing)
  {
    id: 'openai/gpt-5.1',
    name: 'GPT-5.1 (Frontier)',
    provider: 'OpenAI',
    category: 'Premium',
    speed: 'Fast',
    cost: 'High',
    contextWindow: '128K',
    bestFor: 'Complex reasoning, advanced creation',
    pricePerMTok: 0.060
  },
  {
    id: 'openai/gpt-5.1-chat',
    name: 'GPT-5.1 Chat',
    provider: 'OpenAI',
    category: 'Advanced',
    speed: 'Very Fast',
    cost: 'Medium',
    contextWindow: '128K',
    bestFor: 'Interactive chat, high throughput',
    pricePerMTok: 0.030
  },
  {
    id: 'openai/gpt-5-pro',
    name: 'GPT-5 Pro',
    provider: 'OpenAI',
    category: 'Premium',
    speed: 'Medium',
    cost: 'High',
    contextWindow: '128K',
    bestFor: 'Deep reasoning, critical tasks',
    pricePerMTok: 0.050
  },
  {
    id: 'openai/gpt-5',
    name: 'GPT-5',
    provider: 'OpenAI',
    category: 'Premium',
    speed: 'Fast',
    cost: 'High',
    contextWindow: '128K',
    bestFor: 'General purpose advanced tasks',
    pricePerMTok: 0.040
  },
  {
    id: 'openai/gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'OpenAI',
    category: 'Standard',
    speed: 'Very Fast',
    cost: 'Low',
    contextWindow: '128K',
    bestFor: 'Quick tasks, cost effective',
    pricePerMTok: 0.010
  },
  {
    id: 'openai/gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'OpenAI',
    category: 'Standard',
    speed: 'Ultra Fast',
    cost: 'Very Low',
    contextWindow: '128K',
    bestFor: 'Real-time, edge cases',
    pricePerMTok: 0.005
  },
  {
    id: 'openai/o3-deep-research',
    name: 'o3 Deep Research',
    provider: 'OpenAI',
    category: 'Premium',
    speed: 'Slow',
    cost: 'Very High',
    contextWindow: '128K',
    bestFor: 'Extensive research, deep analysis',
    pricePerMTok: 0.080
  },
  {
    id: 'openai/o4-mini-deep-research',
    name: 'o4 Mini Deep Research',
    provider: 'OpenAI',
    category: 'Advanced',
    speed: 'Medium',
    cost: 'Medium',
    contextWindow: '128K',
    bestFor: 'Research on a budget',
    pricePerMTok: 0.025
  },
  {
    id: 'openai/o3-pro',
    name: 'o3 Pro',
    provider: 'OpenAI',
    category: 'Premium',
    speed: 'Medium',
    cost: 'High',
    contextWindow: '128K',
    bestFor: 'Professional reasoning tasks',
    pricePerMTok: 0.060
  },
  {
    id: 'openai/o4-mini-high',
    name: 'o4 Mini High',
    provider: 'OpenAI',
    category: 'Advanced',
    speed: 'Fast',
    cost: 'Medium',
    contextWindow: '128K',
    bestFor: 'High capability small model',
    pricePerMTok: 0.015
  },
  {
    id: 'openai/o4-mini',
    name: 'o4 Mini',
    provider: 'OpenAI',
    category: 'Standard',
    speed: 'Very Fast',
    cost: 'Low',
    contextWindow: '128K',
    bestFor: 'Everyday reasoning',
    pricePerMTok: 0.010
  },
  {
    id: 'openai/o3-mini-high',
    name: 'o3 Mini High',
    provider: 'OpenAI',
    category: 'Advanced',
    speed: 'Fast',
    cost: 'Medium',
    contextWindow: '128K',
    bestFor: 'Balanced reasoning',
    pricePerMTok: 0.020
  },
  {
    id: 'openai/gpt-4o-2024-11-20',
    name: 'GPT-4o (Nov 2024)',
    provider: 'OpenAI',
    category: 'Premium',
    speed: 'Fast',
    cost: 'High',
    contextWindow: '128K',
    bestFor: 'Creative writing, latest capabilities',
    pricePerMTok: 0.030
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    category: 'Standard',
    speed: 'Very Fast',
    cost: 'Low',
    contextWindow: '128K',
    bestFor: 'Quick summaries, chat, edits',
    pricePerMTok: 0.010
  },
  {
    id: 'openai/gpt-4.1',
    name: 'GPT-4.1',
    provider: 'OpenAI',
    category: 'Advanced',
    speed: 'Fast',
    cost: 'Medium',
    contextWindow: '128K',
    bestFor: 'Reliable reasoning',
    pricePerMTok: 0.020
  },
  {
    id: 'openai/gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'OpenAI',
    category: 'Standard',
    speed: 'Very Fast',
    cost: 'Low',
    contextWindow: '128K',
    bestFor: 'General lightweight tasks',
    pricePerMTok: 0.008
  },
  {
    id: 'openai/gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    provider: 'OpenAI',
    category: 'Standard',
    speed: 'Ultra Fast',
    cost: 'Very Low',
    contextWindow: '128K',
    bestFor: 'Fastest responses',
    pricePerMTok: 0.004
  },

  // Anthropic (9 models)
  {
    id: 'anthropic/claude-opus-4.5',
    name: 'Claude 4.5 Opus',
    provider: 'Anthropic',
    category: 'Premium',
    speed: 'Slow',
    cost: 'Very High',
    contextWindow: '200K',
    bestFor: 'Maximum intelligence, heavy research',
    pricePerMTok: 0.080
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude 4.5 Sonnet',
    provider: 'Anthropic',
    category: 'Advanced',
    speed: 'Medium',
    cost: 'High',
    contextWindow: '200K',
    bestFor: 'Coding, nuanced writing',
    pricePerMTok: 0.030
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude 4.5 Haiku',
    provider: 'Anthropic',
    category: 'Standard',
    speed: 'Fast',
    cost: 'Low',
    contextWindow: '200K',
    bestFor: 'Fast, smart interactions',
    pricePerMTok: 0.010
  },
  {
    id: 'anthropic/claude-opus-4.1',
    name: 'Claude 4.1 Opus',
    provider: 'Anthropic',
    category: 'Premium',
    speed: 'Slow',
    cost: 'High',
    contextWindow: '200K',
    bestFor: 'Deep analysis',
    pricePerMTok: 0.060
  },
  {
    id: 'anthropic/claude-opus-4',
    name: 'Claude 4 Opus',
    provider: 'Anthropic',
    category: 'Premium',
    speed: 'Slow',
    cost: 'High',
    contextWindow: '200K',
    bestFor: 'Complex reasoning',
    pricePerMTok: 0.050
  },
  {
    id: 'anthropic/claude-sonnet-4-0',
    name: 'Claude 4 Sonnet',
    provider: 'Anthropic',
    category: 'Advanced',
    speed: 'Medium',
    cost: 'Medium',
    contextWindow: '200K',
    bestFor: 'Daily driver, coding',
    pricePerMTok: 0.020
  },
  {
    id: 'anthropic/claude-3.7-sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    category: 'Advanced',
    speed: 'Medium',
    cost: 'Medium',
    contextWindow: '200K',
    bestFor: 'High quality writing',
    pricePerMTok: 0.015
  },
  {
    id: 'anthropic/claude-3.7-sonnet:thinking',
    name: 'Claude 3.7 Sonnet (Thinking)',
    provider: 'Anthropic',
    category: 'Advanced',
    speed: 'Slow',
    cost: 'Medium',
    contextWindow: '200K',
    bestFor: 'Extended reasoning',
    pricePerMTok: 0.015
  },

  // Gemini (4 models)
  {
    id: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro (Preview)',
    provider: 'Google',
    category: 'Premium',
    speed: 'Fast',
    cost: 'High',
    contextWindow: '2M',
    bestFor: 'Multimodal, frontier tasks',
    pricePerMTok: 0.030
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    category: 'Premium',
    speed: 'Fast',
    cost: 'Medium',
    contextWindow: '2M',
    bestFor: 'Deep reasoning, multimodal',
    pricePerMTok: 0.025
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    category: 'Standard',
    speed: 'Very Fast',
    cost: 'Low',
    contextWindow: '1M',
    bestFor: 'High volume, fast tasks',
    pricePerMTok: 0.010
  },
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    category: 'Standard',
    speed: 'Very Fast',
    cost: 'Very Low',
    contextWindow: '1M',
    bestFor: 'Real-time generation',
    pricePerMTok: 0.005
  }
];

interface ModelContextType {
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  getSelectedModel: () => typeof AVAILABLE_MODELS[0] | undefined;
}

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export function ModelProvider({ children }: { children: ReactNode }) {
  // Default to Gemini 2.5 Flash
  const [selectedModelId, setSelectedModelId] = useState('google/gemini-2.5-flash');

  // Load from local storage on mount
  useEffect(() => {
      const saved = localStorage.getItem('writerai_selected_model');
      if (saved) {
          // Validate it exists
          const exists = AVAILABLE_MODELS.find(m => m.id === saved);
          if (exists) setSelectedModelId(saved);
      }
  }, []);

  // Save on change
  const handleSetModel = (id: string) => {
      setSelectedModelId(id);
      localStorage.setItem('writerai_selected_model', id);
  };

  const getSelectedModel = () => AVAILABLE_MODELS.find(m => m.id === selectedModelId);

  return (
    <ModelContext.Provider value={{ selectedModelId, setSelectedModelId: handleSetModel, getSelectedModel }}>
      {children}
    </ModelContext.Provider>
  );
}

export function useModel() {
  const context = useContext(ModelContext);
  if (context === undefined) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  return context;
}
