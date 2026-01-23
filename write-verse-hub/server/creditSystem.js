/**
 * Credit System Module
 * Handles model tiers, credit deduction, and balance checks
 */

const { createClient } = require('@supabase/supabase-js');

// Model tier credit multipliers
const MODEL_TIERS = {
  // Tier 1: Economy (1x) - Standard category
  'google/gemini-2.0-flash-001': { tier: 1, multiplier: 1.0, name: 'Economy' },
  'google/gemini-2.0-flash': { tier: 1, multiplier: 1.0, name: 'Economy' },
  'google/gemini-2.5-flash': { tier: 1, multiplier: 1.0, name: 'Economy' },
  'openai/gpt-5-mini': { tier: 1, multiplier: 1.0, name: 'Economy' },
  'openai/gpt-5-nano': { tier: 1, multiplier: 1.0, name: 'Economy' },
  'openai/o4-mini': { tier: 1, multiplier: 1.0, name: 'Economy' },
  'openai/gpt-4.1-mini': { tier: 1, multiplier: 1.0, name: 'Economy' },
  'openai/gpt-4.1-nano': { tier: 1, multiplier: 1.0, name: 'Economy' },
  'anthropic/claude-haiku-4.5': { tier: 1, multiplier: 1.0, name: 'Economy' },

  // Tier 2: Standard (2x) - Advanced category
  'openai/gpt-4.1': { tier: 2, multiplier: 2.0, name: 'Standard' },
  'openai/o4-mini-high': { tier: 2, multiplier: 2.0, name: 'Standard' },
  'anthropic/claude-sonnet-4': { tier: 2, multiplier: 2.0, name: 'Standard' },
  'anthropic/claude-3.7-sonnet-thinking': { tier: 2, multiplier: 2.0, name: 'Standard' },
  'google/gemini-2.5-pro': { tier: 2, multiplier: 2.0, name: 'Standard' },

  // Tier 3: Premium (3x) - Premium category
  'openai/gpt-5.1': { tier: 3, multiplier: 3.0, name: 'Premium' },
  'openai/o4': { tier: 3, multiplier: 3.0, name: 'Premium' },
  'anthropic/claude-opus-4.1': { tier: 3, multiplier: 3.0, name: 'Premium' },
  'google/gemini-3-pro-preview': { tier: 3, multiplier: 3.0, name: 'Premium' },

  // Tier 4: Ultra (5x) - Frontier/Max models
  'openai/o4-max': { tier: 4, multiplier: 5.0, name: 'Ultra' }
};

// Default tier for unknown models
const DEFAULT_TIER = { tier: 1, multiplier: 1.0, name: 'Economy' };

/**
 * Get model tier info
 * @param {string} modelId - The model identifier
 * @returns {object} Tier info with tier number, multiplier, and name
 */
function getModelTier(modelId) {
  // Normalize model ID (handle various formats)
  const normalizedId = modelId?.toLowerCase().replace(/\s+/g, '-');
  
  // Try exact match first
  if (MODEL_TIERS[modelId]) {
    return MODEL_TIERS[modelId];
  }
  
  // Try partial match for common model names
  for (const [key, value] of Object.entries(MODEL_TIERS)) {
    if (normalizedId?.includes(key.split('/')[1])) {
      return value;
    }
  }
  
  // Default to Economy tier
  return DEFAULT_TIER;
}

/**
 * Calculate credits to deduct based on tokens and model
 * @param {number} tokensUsed - Number of output tokens
 * @param {string} modelId - The model identifier
 * @returns {object} Credits info { creditsToDeduct, multiplier, tierName }
 */
function calculateCredits(tokensUsed, modelId) {
  const tier = getModelTier(modelId);
  const creditsToDeduct = Math.ceil(tokensUsed * tier.multiplier);
  return {
    creditsToDeduct,
    multiplier: tier.multiplier,
    tierName: tier.name,
    tier: tier.tier
  };
}

/**
 * Check if organization has enough credits
 * @param {object} supabaseAdmin - Supabase admin client
 * @param {string} organizationId - Organization UUID
 * @param {number} minimumRequired - Minimum credits needed (default 1)
 * @returns {Promise<object>} { hasCredits, balance, isNegative }
 */
async function checkCreditsAvailable(supabaseAdmin, organizationId, minimumRequired = 1) {
  try {
    const { data, error } = await supabaseAdmin
      .from('organization_credits')
      .select('balance_credits')
      .eq('organization_id', organizationId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[CreditSystem] Error checking credits:', error);
      throw error;
    }

    const balance = data?.balance_credits || 0;
    return {
      hasCredits: balance >= minimumRequired,
      balance,
      isNegative: balance < 0
    };
  } catch (err) {
    console.error('[CreditSystem] checkCreditsAvailable error:', err);
    // Fail open - allow generation if we can't check (will deduct later)
    return { hasCredits: true, balance: 0, isNegative: false };
  }
}

/**
 * Deduct credits from organization
 * Uses the record_usage_with_tiers RPC function
 * @param {object} supabaseAdmin - Supabase admin client
 * @param {object} params - Deduction parameters
 * @returns {Promise<object>} Result with new balance
 */
async function deductCredits(supabaseAdmin, {
  organizationId,
  userId,
  tool,
  provider = 'gemini',
  action = 'generate',
  tokensUsed,
  modelId,
  metadata = {}
}) {
  try {
    const { data, error } = await supabaseAdmin.rpc('record_usage_with_tiers', {
      p_organization_id: organizationId,
      p_user_id: userId,
      p_tool: tool,
      p_provider: provider,
      p_action: action,
      p_units: tokensUsed,
      p_model_id: modelId,
      p_metadata: metadata
    });

    if (error) {
      console.error('[CreditSystem] Error deducting credits:', error);
      throw error;
    }

    const result = data?.[0] || {};
    console.log('[CreditSystem] Credits deducted:', {
      organizationId,
      tokensUsed,
      modelId,
      creditsDeducted: result.credits_deducted,
      newBalance: result.balance_credits,
      multiplier: result.credit_multiplier
    });

    return {
      success: result.success,
      newBalance: result.balance_credits,
      creditsDeducted: result.credits_deducted,
      multiplier: result.credit_multiplier
    };
  } catch (err) {
    console.error('[CreditSystem] deductCredits error:', err);
    throw err;
  }
}

/**
 * Add credits to organization (for purchases, trials, etc.)
 * @param {object} supabaseAdmin - Supabase admin client
 * @param {string} organizationId - Organization UUID
 * @param {number} credits - Credits to add
 * @param {string} source - Source of credits ('purchase', 'trial', 'promo', 'subscription_renewal')
 * @returns {Promise<number>} New balance
 */
async function addCredits(supabaseAdmin, organizationId, credits, source = 'purchase') {
  try {
    const { data, error } = await supabaseAdmin.rpc('add_credits', {
      p_organization_id: organizationId,
      p_credits: credits,
      p_source: source
    });

    if (error) {
      console.error('[CreditSystem] Error adding credits:', error);
      throw error;
    }

    console.log('[CreditSystem] Credits added:', { organizationId, credits, source, newBalance: data });
    return data;
  } catch (err) {
    console.error('[CreditSystem] addCredits error:', err);
    throw err;
  }
}

/**
 * Create insufficient credits error response
 * @param {number} currentBalance - Current credit balance
 * @returns {object} Error response object
 */
function createInsufficientCreditsError(currentBalance) {
  return {
    error: 'INSUFFICIENT_CREDITS',
    message: 'You have run out of credits. Please purchase more or upgrade your plan.',
    currentBalance,
    upgradeUrl: '/subscription/pricing',
    purchaseUrl: '/subscription?action=buy-credits'
  };
}

module.exports = {
  MODEL_TIERS,
  DEFAULT_TIER,
  getModelTier,
  calculateCredits,
  checkCreditsAvailable,
  deductCredits,
  addCredits,
  createInsufficientCreditsError
};
