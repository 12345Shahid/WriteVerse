# WriteVerse Hub - Pricing & Credit Deduction System

> **Document Purpose**: Complete specification for pricing tiers, credit deduction logic, and the proposed credit economy system.

---

## Section 1: Current Pricing Tiers

The following pricing is displayed on the Trial Setup page (`/subscription/trial`) after user signup.

### Plan Comparison

| Plan | Monthly Price | Yearly Price | Seats | Monthly Credits | Trial Credits |
|------|---------------|--------------|-------|-----------------|---------------|
| **Starter** | $29/mo | $244/yr | 1 | 30,000 | 2,000 |
| **Professional** | $79/mo | $665/yr | 5 | 100,000 | 2,000 |
| **Business** | $199/mo | $1,681/yr | 15 | 300,000 | 2,000 |
| **Enterprise** | Contact Us | Custom | Unlimited | Custom | Custom |

> **Note**: Trial is 7 days with 2,000 credits for all plans. No credit card required during trial.

---

### Feature Matrix by Plan

| Feature | Starter | Professional | Business | Enterprise |
|---------|---------|--------------|----------|------------|
| All 25+ Specialized Tools | ✅ | ✅ | ✅ | ✅ |
| Custom Agents | 1-2 | 5 | Unlimited | Unlimited |
| Knowledge Base Storage | 100 MB | 1 GB | 10 GB | Custom |
| Workflows | Basic (3-5 steps) | Advanced (unlimited) | Unlimited | Unlimited |
| Team Seats | 1 | 5 | 15 | Unlimited |
| Brand Voice Profiles | 1 | Unlimited | Unlimited | Unlimited |
| Analytics History | 30 days | All time | All time | All time |
| Embed Chatbot | ❌ | 3 instances | Unlimited | Unlimited |
| Composio Integrations | ❌ | 500+ apps | Priority | Dedicated |
| API Access | ❌ | ❌ | 100K req/mo | Custom |
| Priority Support | ❌ | ❌ | 24h response | Dedicated manager |
| White-label | ❌ | ❌ | ❌ | ✅ |

---

## Section 2: Credit Deduction Sources

Credits are deducted from **5 distinct sources** visible in the Analytics page (`/analytics`):

### 2.1 Specialized Tools
All 25+ writing tools in `/tools/*`:
- Email Subject Generator
- Resume Writer
- Cold Email Tool
- Product Description
- Job Description
- LinkedIn Post Generator
- Social Ad Copy
- Summarizer
- Cover Letter
- Twitter Thread
- FAQ Generator
- Script Tool
- Blog Helper
- Copy Helper
- Social Helper
- Email Writer
- Rewrite Helper
- Blog Post Writer
- Article from Outline
- SEO Blog Optimizer
- Case Study Writer
- Landing Page Writer
- Report Writer

**Output Characteristics**:
| Tool Category | Typical Output Length | Output Tokens (avg) |
|--------------|----------------------|---------------------|
| Short-form (subject lines, headlines) | 50-150 chars | 20-50 tokens |
| Medium-form (social posts, emails) | 200-800 chars | 60-250 tokens |
| Long-form (blog posts, articles, reports) | 1500-5000+ chars | 500-2000+ tokens |

---

### 2.2 Workflows
Multi-step automated content pipelines:
- Research Agent → Content Critic → LinkedIn Post Generator
- Custom multi-tool chains

**Output Characteristics**: Varies greatly. A 3-step workflow might generate 1,000-3,000 tokens total.

---

### 2.3 Custom Agents
User-created AI agents with custom instructions:
- Knowledge-base powered
- Multi-turn conversations
- Model-selectable

**Output Characteristics**: Each response typically 100-800 tokens depending on query complexity.

---

### 2.4 Embedded Chats
Customer-facing chatbots embedded on external websites:
- Agent-backed
- Public-facing
- High usage potential

**Output Characteristics**: Similar to agents, 100-500 tokens per response, but potentially high volume.

---

### 2.5 Templates
Pre-configured generation templates:
- Custom prompts with variable substitution
- Single-generation outputs

**Output Characteristics**: 200-1500 tokens depending on template complexity.

---

## Section 3: Model Pricing via OpenRouter

WriteVerse Hub uses **OpenRouter** to access multiple AI models. The cost varies significantly by model.

### Available Models & Pricing

| Model ID | Display Name | Provider | Price/1M Tokens | Category | Speed |
|----------|--------------|----------|-----------------|----------|-------|
| `openai/gpt-5.1` | GPT-5.1 (Frontier) | OpenAI | $0.060 | Premium | Fast |
| `openai/gpt-5.1-chat` | GPT-5.1 Chat | OpenAI | $0.030 | Advanced | Very Fast |
| `openai/gpt-5-pro` | GPT-5 Pro | OpenAI | $0.050 | Premium | Medium |
| `openai/gpt-5` | GPT-5 | OpenAI | $0.040 | Premium | Fast |
| `openai/gpt-5-mini` | GPT-5 Mini | OpenAI | $0.010 | Standard | Very Fast |
| `openai/gpt-5-nano` | GPT-5 Nano | OpenAI | $0.005 | Standard | Ultra Fast |
| `openai/o3-deep-research` | o3 Deep Research | OpenAI | $0.080 | Premium | Slow |
| `openai/o4-mini-deep-research` | o4 Mini Deep Research | OpenAI | $0.025 | Advanced | Medium |
| `openai/o3-pro` | o3 Pro | OpenAI | $0.060 | Premium | Medium |
| `openai/o4-mini-high` | o4 Mini High | OpenAI | $0.015 | Advanced | Fast |
| `openai/o4-mini` | o4 Mini | OpenAI | $0.010 | Standard | Very Fast |
| `openai/o3-mini-high` | o3 Mini High | OpenAI | $0.020 | Advanced | Fast |
| `openai/gpt-4o-2024-11-20` | GPT-4o (Nov 2024) | OpenAI | $0.030 | Premium | Fast |
| `openai/gpt-4o-mini` | GPT-4o Mini | OpenAI | $0.010 | Standard | Very Fast |
| `openai/gpt-4.1` | GPT-4.1 | OpenAI | $0.020 | Advanced | Fast |
| `openai/gpt-4.1-mini` | GPT-4.1 Mini | OpenAI | $0.008 | Standard | Very Fast |
| `openai/gpt-4.1-nano` | GPT-4.1 Nano | OpenAI | $0.004 | Standard | Ultra Fast |
| `anthropic/claude-opus-4.5` | Claude 4.5 Opus | Anthropic | $0.080 | Premium | Slow |
| `anthropic/claude-sonnet-4.5` | Claude 4.5 Sonnet | Anthropic | $0.030 | Advanced | Medium |
| `anthropic/claude-haiku-4.5` | Claude 4.5 Haiku | Anthropic | $0.010 | Standard | Fast |
| `anthropic/claude-opus-4.1` | Claude 4.1 Opus | Anthropic | $0.060 | Premium | Slow |
| `anthropic/claude-opus-4` | Claude 4 Opus | Anthropic | $0.050 | Premium | Slow |
| `anthropic/claude-sonnet-4-0` | Claude 4 Sonnet | Anthropic | $0.020 | Advanced | Medium |
| `anthropic/claude-3.7-sonnet` | Claude 3.7 Sonnet | Anthropic | $0.015 | Advanced | Medium |
| `anthropic/claude-3.7-sonnet:thinking` | Claude 3.7 Sonnet (Thinking) | Anthropic | $0.015 | Advanced | Slow |
| `google/gemini-3-pro-preview` | Gemini 3 Pro (Preview) | Google | $0.030 | Premium | Fast |
| `google/gemini-2.5-pro` | Gemini 2.5 Pro | Google | $0.025 | Premium | Fast |
| `google/gemini-2.5-flash` | Gemini 2.5 Flash | Google | $0.010 | Standard | Very Fast |
| `google/gemini-2.0-flash-001` | Gemini 2.0 Flash | Google | $0.005 | Standard | Very Fast |

> **Default Model**: `google/gemini-2.5-flash` ($0.010/1M tokens)

---

### Model Tier Summary

| Tier | Price Range | Example Models |
|------|-------------|----------------|
| **Very Low Cost** | $0.004-0.005/1M | GPT-4.1 Nano, GPT-5 Nano, Gemini 2.0 Flash |
| **Low Cost** | $0.008-0.015/1M | GPT-4.1 Mini, GPT-5 Mini, o4 Mini, Claude Haiku, Gemini 2.5 Flash |
| **Medium Cost** | $0.015-0.030/1M | GPT-4.1, Claude Sonnet, Gemini 2.5 Pro |
| **High Cost** | $0.040-0.060/1M | GPT-5, Claude Opus, o3 Pro |
| **Very High Cost** | $0.080/1M | Claude 4.5 Opus, o3 Deep Research |

---

## Section 4: Proposed Credit Deduction System

### 4.1 Core Business Constraints

| Constraint | Target |
|------------|--------|
| **Profit Margin** | 70% minimum |
| **Cost Budget** | 25% of revenue max (5% buffer) |
| **Credit Value** | $1 = 1,000 credits |
| **Actual LLM Cost Budget** | $0.25 per $1 spent |

---

### 4.2 Credit-Token Calculation Formula

The key insight: **1 credit ≠ 1 token** because model costs vary 16x (from $0.005 to $0.080 per 1M tokens).

#### Base Rate Calculation

We need to find a "base credit cost" that ensures profitability across all models.

**Given**:
- User pays $1 → Gets 1,000 credits
- We can spend max $0.25 on LLM costs
- OpenRouter adds ~5.5% fee → effective budget = $0.237

**Model-Specific Credit Rates**:

For each model, calculate: `Credits per 1000 output tokens = (Output tokens × Model price) / Base cost`

Using **$0.010/1M tokens** as baseline (Gemini 2.5 Flash = default):
- 1000 tokens × $0.010/1M = $0.00001 = 0.001 cents

To hit 70% margin with $0.25 budget per $1:
- Max tokens from $0.25 at baseline: 25,000,000 tokens = 25M tokens
- Credits per $0.25 budget = 1,000 credits
- **1 credit should = ~25,000 tokens at baseline**

This is too generous. Let's recalculate for sustainability:

---

### 4.3 Recommended Credit System

#### Option A: Fixed Credit = Token Ratio (Simplest)

**1 credit = 1 output token** (regardless of model)

User experience: Simple, predictable
Problem: You lose money on expensive models

| Model | Price/1M tokens | Cost for 1000 tokens | Credits charged | Your Cost | Revenue ($0.001/credit) | Margin |
|-------|-----------------|---------------------|-----------------|-----------|------------------------|--------|
| Gemini 2.0 Flash | $0.005 | $0.000005 | 1000 | $0.000005 | $1.00 | 99.99% ✅ |
| Gemini 2.5 Flash | $0.010 | $0.00001 | 1000 | $0.00001 | $1.00 | 99.99% ✅ |
| Claude 4.5 Opus | $0.080 | $0.00008 | 1000 | $0.00008 | $1.00 | 99.99% ✅ |

**Verdict**: This works! At $1/1000 credits and actual LLM costs being fractions of cents per 1000 tokens, you're always profitable.

---

#### Option B: Model-Weighted Credits (Recommended for Fairness)

Different models cost different credits based on their cost tier.

**Base Rate**: 1 credit = 1 token at baseline model (Gemini 2.5 Flash = $0.010/1M)

**Credit Multipliers by Model**:

| Model Category | Price Tier | Credit Multiplier | Credits per 1000 tokens |
|----------------|------------|-------------------|------------------------|
| Very Low Cost ($0.004-0.005) | Tier 0 | 0.5x | 500 credits |
| Low Cost ($0.008-0.015) | Tier 1 | 1.0x | 1,000 credits |
| Medium Cost ($0.015-0.030) | Tier 2 | 2.0x | 2,000 credits |
| High Cost ($0.040-0.060) | Tier 3 | 4.0x | 4,000 credits |
| Very High Cost ($0.080) | Tier 4 | 8.0x | 8,000 credits |

**Example Usage**:

| Scenario | Model | Output Tokens | Credits Used |
|----------|-------|---------------|--------------|
| Email subject lines (3) | Gemini 2.5 Flash | 150 | 150 credits |
| Blog post | Claude 3.7 Sonnet | 1200 | 2,400 credits |
| Deep research report | Claude 4.5 Opus | 2500 | 20,000 credits |

---

### 4.4 Profitability Analysis (Option B)

**Assumptions**:
- Plan: Starter ($29/mo = 30,000 credits)
- User behavior: 80% low-cost models, 15% medium, 5% high

**Cost Breakdown**:

| Usage | %Share | Credits | Tokens | Model Tier | LLM Cost |
|-------|--------|---------|--------|------------|----------|
| Short-form | 60% | 18,000 | 18,000 | Tier 1 ($0.01/1M) | $0.00018 |
| Medium-form | 30% | 9,000 | 4,500 | Tier 2 ($0.02/1M) | $0.00009 |
| Long-form | 10% | 3,000 | 375 | Tier 4 ($0.08/1M) | $0.00003 |
| **Total** | 100% | 30,000 | 22,875 | - | **$0.00030** |

**Result**: 
- Revenue: $29
- LLM Cost: ~$0.30 (worst case, much less in practice)
- **Gross Margin: 99%+**

> **Reality Check**: OpenRouter charges per 1M tokens, so even heavy users consuming 30,000 credits (≈22K tokens) cost you < $1 in LLM fees.

---

### 4.5 Recommended Implementation

#### Credit Deduction Logic

```typescript
interface CreditCalculation {
  outputTokens: number;
  modelId: string;
  creditMultiplier: number;
  creditsCharged: number;
}

const MODEL_TIERS: Record<string, number> = {
  // Tier 0: 0.5x
  'openai/gpt-5-nano': 0.5,
  'openai/gpt-4.1-nano': 0.5,
  'google/gemini-2.0-flash-001': 0.5,
  
  // Tier 1: 1.0x (baseline)
  'openai/gpt-5-mini': 1.0,
  'openai/gpt-4o-mini': 1.0,
  'openai/gpt-4.1-mini': 1.0,
  'openai/o4-mini': 1.0,
  'anthropic/claude-haiku-4.5': 1.0,
  'google/gemini-2.5-flash': 1.0,
  
  // Tier 2: 2.0x
  'openai/gpt-4.1': 2.0,
  'openai/o3-mini-high': 2.0,
  'openai/o4-mini-high': 1.5,
  'openai/o4-mini-deep-research': 2.5,
  'anthropic/claude-sonnet-4-0': 2.0,
  'anthropic/claude-3.7-sonnet': 1.5,
  'anthropic/claude-3.7-sonnet:thinking': 1.5,
  'google/gemini-2.5-pro': 2.5,
  
  // Tier 3: 4.0x
  'openai/gpt-5.1-chat': 3.0,
  'openai/gpt-4o-2024-11-20': 3.0,
  'anthropic/claude-sonnet-4.5': 3.0,
  'google/gemini-3-pro-preview': 3.0,
  'openai/gpt-5': 4.0,
  'openai/gpt-5-pro': 5.0,
  'anthropic/claude-opus-4': 5.0,
  
  // Tier 4: 6-8x
  'openai/gpt-5.1': 6.0,
  'openai/o3-pro': 6.0,
  'anthropic/claude-opus-4.1': 6.0,
  'openai/o3-deep-research': 8.0,
  'anthropic/claude-opus-4.5': 8.0,
};

function calculateCredits(outputTokens: number, modelId: string): number {
  const multiplier = MODEL_TIERS[modelId] ?? 1.0;
  return Math.ceil(outputTokens * multiplier);
}
```

---

### 4.6 Output Length Considerations by Tool Type

Different tools have vastly different token outputs:

| Tool/Feature | Typical Output Tokens | Credit Impact (Tier 1) | Credit Impact (Tier 4) |
|--------------|----------------------|------------------------|------------------------|
| Email Subject Lines (×10) | 200-400 | 200-400 | 1,600-3,200 |
| LinkedIn Post (×3) | 600-900 | 600-900 | 4,800-7,200 |
| Blog Post | 1500-2500 | 1500-2500 | 12,000-20,000 |
| Full Article | 2000-4000 | 2000-4000 | 16,000-32,000 |
| Research Report | 3000-6000 | 3000-6000 | 24,000-48,000 |
| Agent Chat Response | 100-500 | 100-500 | 800-4,000 |
| Workflow (3-step) | 1500-4000 | 1500-4000 | 12,000-32,000 |

---

### 4.7 Plan Credit Allocation Validation

| Plan | Credits | Cheap Model Usage (Tier 0-1) | Expensive Model Usage (Tier 4) |
|------|---------|------------------------------|-------------------------------|
| Starter (30K) | 30,000 | ~30,000 tokens = 50-100 blog posts | ~3,750 tokens = 1-2 research reports |
| Professional (100K) | 100,000 | ~100,000 tokens = 200+ blog posts | ~12,500 tokens = 4-6 research reports |
| Business (300K) | 300,000 | ~300,000 tokens = 600+ blog posts | ~37,500 tokens = 15-25 research reports |

---

## Section 5: Implementation Summary

### Database Changes
1. Add `model_tier` lookup table or use `ModelContext.tsx` pricing
2. Modify credit deduction to multiply by tier multiplier
3. Log both raw tokens AND credits charged in `analytics_events`

### API Changes
1. Return `outputTokens` and `creditsCharged` from generation endpoints
2. Apply multiplier based on `modelId` used

### Frontend Changes
1. Show credit multiplier badge next to model selector (e.g., "2x credits")
2. Display estimated credits before generation for expensive models
3. Warn users when selecting Tier 3-4 models

### Credit Tracking Schema
```sql
ALTER TABLE analytics_events ADD COLUMN output_tokens INTEGER;
ALTER TABLE analytics_events ADD COLUMN model_tier DECIMAL(3,1);
-- credits_used already exists (now = output_tokens × model_tier)
```

---

## Appendix: Quick Reference

### Margin Calculator

| Revenue per $1 | LLM Budget (25%) | Buffer (5%) | Net Profit (70%) |
|----------------|------------------|-------------|------------------|
| $1.00 | $0.25 | $0.05 | $0.70 |
| $29 (Starter) | $7.25 | $1.45 | $20.30 |
| $79 (Pro) | $19.75 | $3.95 | $55.30 |
| $199 (Business) | $49.75 | $9.95 | $139.30 |

### OpenRouter Fee
- **Payment processing**: 5.5% on credit purchases (min $0.80)
- **Already factored into**: LLM budget calculations above

---

> **Document Author**: WriteVerse Engineering
> **Last Updated**: December 2024
> **Version**: 1.0
