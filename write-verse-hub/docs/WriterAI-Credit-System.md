WriterAI Token-Based Credit System - Complete Implementation Guide
Overview
WriterAI uses a variable token-based credit system where users are charged based on actual token usage (input + output tokens) rather than a flat rate per generation. This ensures fair pricing, protects margins, and aligns with industry standards used by OpenAI, Anthropic, and Google.

Core Principle: 1 Credit = 1 Output Token (pricing based on actual LLM usage)

Part 1: Credit Tiers System
Four-Tier Model Grouping
All 31 models are grouped into 4 credit tiers based on their multiplier values. Users select a model, and their credit deduction is calculated based on actual tokens generated.

TIER 1: BUDGET (1 Credit Per Output Token)
Multiplier Range: 0.4-0.8x
Use Case: Fast, cost-efficient generations
Best For: Social media, quick summaries, rapid iterations

Models in Tier 1:

openai/gpt-5-nano (0.5x)

openai/gpt-4.1-nano (0.4x)

openai/gpt-4o-mini (0.8x)

openai/gpt-4.1-mini (0.8x)

openai/o4-mini (1.0x) rounded to Tier 1

anthropic/claude-haiku-4.5 (1.0x) rounded to Tier 1

google/gemini-2.0-flash-001 (0.5x)

google/gemini-2.5-flash (1.0x)

Credit Cost Formula:

text
Credits Deducted = Output Tokens × 1
Example: 500 output tokens = 1 credit
Monthly Cost Estimate (10,000 words = ~40,000 tokens output/month):

40,000 output tokens × 1 = 40 credits

40 credits ÷ 1,000 (credits per $1) = $0.04/month

TIER 2: STANDARD (2 Credits Per Output Token)
Multiplier Range: 1.0-1.5x
Use Case: Balanced quality and speed
Best For: Most writing tasks (blogs, emails, social media)

Models in Tier 2:

openai/gpt-5-mini (1.0x)

openai/o3-mini-high (2.0x) adjusted to Tier 2

openai/o4-mini-high (1.5x)

openai/gpt-4.1 (2.0x) adjusted to Tier 2

openai/o4-mini-deep-research (2.5x) adjusted to Tier 2

anthropic/claude-3.7-sonnet (1.5x)

anthropic/claude-3.7-sonnet:thinking (1.5x)

anthropic/claude-sonnet-4-0 (2.0x)

Credit Cost Formula:

text
Credits Deducted = Output Tokens × 2
Example: 500 output tokens = 2 credits
Monthly Cost Estimate (10,000 words = ~40,000 tokens output/month):

40,000 output tokens × 2 = 80 credits

80 credits ÷ 1,000 = $0.08/month

TIER 3: ADVANCED (4 Credits Per Output Token)
Multiplier Range: 2.5-3.5x
Use Case: Premium quality, advanced reasoning
Best For: Complex blog posts, detailed content, professional writing

Models in Tier 3:

openai/gpt-5 (4.0x)

openai/gpt-5-pro (5.0x) adjusted to Tier 3

openai/gpt-5.1-chat (3.0x)

openai/gpt-4o-2024-11-20 (3.0x)

google/gemini-3-pro-preview (3.0x)

google/gemini-2.5-pro (2.5x)

anthropic/claude-sonnet-4.5 (3.0x)

Credit Cost Formula:

text
Credits Deducted = Output Tokens × 4
Example: 500 output tokens = 4 credits
Monthly Cost Estimate (10,000 words = ~40,000 tokens output/month):

40,000 output tokens × 4 = 160 credits

160 credits ÷ 1,000 = $0.16/month

TIER 4: FRONTIER (8 Credits Per Output Token)
Multiplier Range: 5.0-8.0x
Use Case: Maximum intelligence, extensive reasoning
Best For: Research-heavy tasks, multi-step workflows, critical analysis

Models in Tier 4:

openai/gpt-5.1 (6.0x)

openai/o3-pro (6.0x)

openai/o3-deep-research (8.0x)

anthropic/claude-opus-4 (5.0x)

anthropic/claude-opus-4.1 (6.0x)

anthropic/claude-opus-4.5 (8.0x)

Credit Cost Formula:

text
Credits Deducted = Output Tokens × 8
Example: 500 output tokens = 8 credits
Monthly Cost Estimate (10,000 words = ~40,000 tokens output/month):

40,000 output tokens × 8 = 320 credits

320 credits ÷ 1,000 = $0.32/month

Part 2: How Token Counting Works
Input vs Output Tokens
Token Type	Definition	Charged?
Input Tokens	Tokens in user's prompt + system prompt + context	NO (free)
Output Tokens	Tokens the model generates	YES (charged)
Example:

text
User Prompt: "Write a 1,000-word blog post about AI trends"
System Prompt: [Context, brand voice, guidelines]

Total Input Tokens: ~150 tokens
Model Output: ~1,200 tokens

Credits Deducted: 1,200 tokens (output only)
Token Counting Examples
Example 1: Blog Post (Tier 2 Model)

text
Prompt: "Write a 2,000-word professional blog post about SaaS pricing"
Input Tokens: ~200
Output Tokens: ~1,800 (approx 1 token = 0.75 words)
Credits Deducted: 1,800 × 2 = 3,600 credits
Example 2: Email (Tier 1 Model)

text
Prompt: "Write a professional sales email"
Input Tokens: ~100
Output Tokens: ~250
Credits Deducted: 250 × 1 = 250 credits
Example 3: Deep Research (Tier 4 Model)

text
Prompt: "Analyze competitor strategies and write comprehensive report"
Input Tokens: ~500 (includes research context)
Output Tokens: ~3,000
Credits Deducted: 3,000 × 8 = 24,000 credits
Part 3: Pricing Plans with Token-Based Credits
Credit Pricing Structure
Base Rule: 1,000 Credits = $1

Dollar Amount	Total Credits	Cost per 1K Credits
$10	10,000	$1.00 per 1K
$30	30,000	$1.00 per 1K
$99	99,000	$1.00 per 1K
Why these amounts?

$10: Entry-level for testing models

$30: Sweet spot for small creators

$99: Professional/agency tier

Part 4: Complete Plan Examples
PLAN 1: $10 Purchase (10,000 Credits)
User buys: $10 → Receives 10,000 Credits

Scenario 1a: Using Tier 1 (Budget) Model
Model: Gemini 2.0 Flash
Task: Generate 5 social media posts

text
Posts per generation: ~100 tokens output per post × 5 = 500 tokens
Credits per generation: 500 × 1 = 500 credits
Number of generations: 10,000 ÷ 500 = 20 generations possible
What user gets:

20 complete social media campaigns (100 posts total)

Estimated output: ~75,000 words of content

Cost: $10

Scenario 1b: Using Tier 2 (Standard) Model
Model: GPT-4.1
Task: Generate blog post outlines and drafts

text
Blog outline: ~200 output tokens
Blog draft (1,500 words): ~1,200 output tokens
Total per blog: 1,400 output tokens
Credits per blog: 1,400 × 2 = 2,800 credits
Number of complete blogs: 10,000 ÷ 2,800 = 3.5 blogs
What user gets:

3-4 complete blog posts with outlines and drafts

Estimated output: ~6,000 words

Cost: $10

Scenario 1c: Using Tier 4 (Frontier) Model
Model: GPT-5.1 (Deep Reasoning)
Task: In-depth market analysis and strategic recommendations

text
Comprehensive analysis: ~3,000 output tokens
Credits: 3,000 × 8 = 24,000 credits
Number of analyses: 10,000 ÷ 24,000 = 0.41 (less than 1)
What user gets:

Cannot complete even 1 full deep analysis

Can partially use for less complex tasks

Cost: $10 (illustrates why Frontier is premium)

PLAN 2: $30 Purchase (30,000 Credits)
User buys: $30 → Receives 30,000 Credits

Scenario 2a: Mixed Model Usage (Recommended)
Strategy: Use cheaper models for draft, expensive for polish

text
Step 1: Generate 10 blog drafts using Tier 2
- 10 blogs × 1,400 output tokens × 2 = 28,000 credits

Step 2: Remaining credits
- 30,000 - 28,000 = 2,000 credits left
- Use Tier 1 model for quick variations/rewrites
- 2,000 ÷ 1 = 2,000 output tokens possible
- Could generate 4 social media posts from blog content
What user gets:

10 complete blog posts

4 variations/social posts from those blogs

Estimated output: ~15,000-18,000 words

Cost: $30

Scenario 2b: Using Tier 3 (Advanced) Model Exclusively
Model: Claude Sonnet 4.5
Task: Generate high-quality professional content

text
Per generation: ~2,000 output tokens
Credits per generation: 2,000 × 4 = 8,000 credits
Number of generations: 30,000 ÷ 8,000 = 3.75 generations
What user gets:

3-4 professional articles/in-depth pieces

Estimated output: ~8,000 words of premium content

Cost: $30

Scenario 2c: Tier 4 Model for Premium Task
Model: Claude Opus 4.5
Task: Comprehensive business strategy analysis

text
Per analysis: ~2,500 output tokens
Credits per analysis: 2,500 × 8 = 20,000 credits
Number of analyses: 30,000 ÷ 20,000 = 1.5 analyses
What user gets:

1-2 deep strategic analyses

Estimated output: ~5,000 words of expert-level content

Cost: $30

PLAN 3: $99 Purchase (99,000 Credits)
User buys: $99 → Receives 99,000 Credits

Scenario 3a: Content Agency (Monthly Workload)
Strategy: Mix of all tiers for full content operation

text
Content Mix:
├─ 25 blog posts (Tier 2): 25 × 1,400 × 2 = 70,000 credits
├─ 50 social posts (Tier 1): 50 × 100 × 1 = 5,000 credits
├─ 10 email sequences (Tier 1): 10 × 200 × 1 = 2,000 credits
├─ 2 research reports (Tier 3): 2 × 2,000 × 4 = 16,000 credits
└─ Buffer remaining: 6,000 credits

Total: ~99,000 credits
What user gets:

25 blog posts (complete, polished)

50 social media posts

10 email sequences

2 deep research reports

Estimated total output: ~50,000+ words

Cost: $99 (per month)

Scenario 3b: Professional Writer (Mixed Quality Approach)
Strategy: Balance between speed and quality

text
Content Mix:
├─ 15 premium blogs (Tier 3): 15 × 2,000 × 4 = 120,000 credits (over budget)
└─ Adjusted: 10 premium blogs (Tier 3): 10 × 2,000 × 4 = 80,000 credits
├─ 5 standard blogs (Tier 2): 5 × 1,400 × 2 = 14,000 credits
└─ Remaining: 5,000 credits for variations

Total: ~99,000 credits
What user gets:

10 high-quality premium articles

5 solid standard articles

Multiple variations/rewrites

Estimated output: ~25,000+ words of quality content

Cost: $99

Scenario 3c: Heavy Research Focused
Strategy: Premium model usage for analysis

text
Content Mix:
├─ 4 comprehensive analyses (Tier 4): 4 × 2,500 × 8 = 80,000 credits
├─ 2 strategy reports (Tier 3): 2 × 2,000 × 4 = 16,000 credits
└─ Remaining: 3,000 credits for quick summaries

Total: ~99,000 credits
What user gets:

4 deep-research comprehensive analyses

2 strategic reports

Multiple summary variations

Estimated output: ~15,000-18,000 words of research-grade content

Cost: $99

Part 5: Detailed Token Calculation Examples
Example 1: Blog Post Generation
Tool: Blog Post Writer
Model Selected: GPT-4.1 (Tier 2, 2 credits per output token)
User Input: "Write a 2,000-word blog post about 'AI in Startups'"

Step-by-Step Calculation:

text
INPUTS:
User Prompt: "Write a 2,000-word blog post about AI in startups"
System Prompt (Brand Voice): [150 tokens of guidelines, tone, style]
Context/Knowledge Base: [50 tokens of brand information]
Total Input Tokens: ~200 tokens

PROCESSING:
Model processes all input tokens
Generates blog post: ~1,800-2,000 output tokens (1 token ≈ 0.75 words)
Output Tokens: 1,850 tokens

CREDIT CALCULATION:
Tier 2 (Standard) = 2 credits per output token
1,850 output tokens × 2 = 3,700 credits deducted

FROM PLAN:
If user bought $30 plan (30,000 credits):
Credits remaining: 30,000 - 3,700 = 26,300 credits
Result: User gets 2,000-word blog post for 3,700 credits

Example 2: Email Sequence Generation
Tool: Email Generator
Model Selected: Gemini 2.0 Flash (Tier 1, 1 credit per output token)
User Input: "Create 5-email nurture sequence for SaaS product"

Step-by-Step Calculation:

text
INPUTS:
User Prompt: "Create 5-email nurture sequence for SaaS"
System Prompt: [Brand guidelines, email templates]
Total Input Tokens: ~150 tokens

PROCESSING:
5 emails generated (average 250 tokens per email):
Email 1: 280 tokens
Email 2: 260 tokens
Email 3: 240 tokens
Email 4: 270 tokens
Email 5: 250 tokens
Total Output Tokens: 1,300 tokens

CREDIT CALCULATION:
Tier 1 (Budget) = 1 credit per output token
1,300 output tokens × 1 = 1,300 credits deducted

FROM PLAN:
If user bought $10 plan (10,000 credits):
Credits remaining: 10,000 - 1,300 = 8,700 credits
Enough for: 6-7 more email sequences or 17+ social posts
Result: User gets 5 emails for 1,300 credits

Example 3: In-Depth Analysis (Tier 4)
Tool: Custom Agent + Workflow
Model Selected: Claude Opus 4.5 (Tier 4, 8 credits per output token)
User Input: "Analyze 3 competitors and provide strategic recommendations"

Step-by-Step Calculation:

text
INPUTS:
User Prompt: "Analyze competitors..."
System Prompt: [Strategic analysis framework]
Context: [Company background, market data - 300 tokens]
Total Input Tokens: ~450 tokens

PROCESSING:
Comprehensive analysis:
- Competitor 1 analysis: 800 tokens
- Competitor 2 analysis: 850 tokens
- Competitor 3 analysis: 820 tokens
- Strategic recommendations: 600 tokens
Total Output Tokens: 3,070 tokens

CREDIT CALCULATION:
Tier 4 (Frontier) = 8 credits per output token
3,070 output tokens × 8 = 24,560 credits deducted

FROM PLAN:
If user bought $99 plan (99,000 credits):
Credits remaining: 99,000 - 24,560 = 74,440 credits
Enough for: 3 more analyses OR 50+ standard blogs
Result: User gets strategic analysis for 24,560 credits

Part 6: Implementation in Code
Database Schema
sql
-- Credit tiers table
CREATE TABLE credit_tiers (
  id SERIAL PRIMARY KEY,
  tier_name VARCHAR(50),
  credit_multiplier INTEGER,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO credit_tiers (tier_name, credit_multiplier, description) VALUES
  ('BUDGET', 1, 'Fast, cost-efficient'),
  ('STANDARD', 2, 'Balanced quality and speed'),
  ('ADVANCED', 4, 'Premium quality, advanced reasoning'),
  ('FRONTIER', 8, 'Maximum intelligence, extensive reasoning');

-- Models to tiers mapping
CREATE TABLE model_credit_mapping (
  id SERIAL PRIMARY KEY,
  model_id VARCHAR(100),
  model_name VARCHAR(200),
  tier_id INTEGER REFERENCES credit_tiers(id),
  api_multiplier DECIMAL(3,1),
  UNIQUE(model_id)
);

-- User credit transactions
CREATE TABLE credit_transactions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  transaction_type VARCHAR(50), -- 'purchase', 'deduction', 'refund'
  amount_credits INTEGER,
  reason TEXT,
  model_used VARCHAR(100),
  output_tokens INTEGER,
  tool_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- User credit balance
CREATE TABLE user_credit_balance (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) UNIQUE,
  total_credits INTEGER DEFAULT 0,
  used_credits INTEGER DEFAULT 0,
  remaining_credits INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);
Backend API: Credit Deduction Logic
javascript
// services/credit-calculation.js

// Get tier multiplier for model
async function getTierMultiplier(modelId) {
  const mapping = await db.query(
    'SELECT credit_multiplier FROM model_credit_mapping WHERE model_id = $1',
    [modelId]
  );
  
  if (!mapping.rows.length) {
    throw new Error(`Model ${modelId} not found`);
  }
  
  return mapping.rows.credit_multiplier;
}

// Calculate credits needed for generation
async function calculateCreditsNeeded(modelId, outputTokens) {
  const tierMultiplier = await getTierMultiplier(modelId);
  const creditsNeeded = outputTokens * tierMultiplier;
  
  return {
    outputTokens,
    tierMultiplier,
    creditsNeeded,
    costEquivalent: creditsNeeded / 1000 // Convert to dollars
  };
}

// Deduct credits after successful generation
async function deductCredits(userId, generation) {
  const { modelId, outputTokens, toolName } = generation;
  
  const tierMultiplier = await getTierMultiplier(modelId);
  const creditsToDeduct = outputTokens * tierMultiplier;
  
  // Check balance
  const balance = await db.query(
    'SELECT remaining_credits FROM user_credit_balance WHERE user_id = $1',
    [userId]
  );
  
  if (balance.rows.remaining_credits < creditsToDeduct) {
    throw new Error('Insufficient credits');
  }
  
  // Record transaction
  await db.query(
    `INSERT INTO credit_transactions 
     (user_id, transaction_type, amount_credits, model_used, output_tokens, tool_name, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, 'deduction', creditsToDeduct, modelId, outputTokens, toolName, `${toolName} generation`]
  );
  
  // Update balance
  await db.query(
    `UPDATE user_credit_balance 
     SET used_credits = used_credits + $1,
         remaining_credits = remaining_credits - $1,
         updated_at = NOW()
     WHERE user_id = $2`,
    [creditsToDeduct, userId]
  );
  
  return {
    creditsDeducted: creditsToDeduct,
    previousBalance: balance.rows.remaining_credits,
    newBalance: balance.rows.remaining_credits - creditsToDeduct,
    costEquivalent: creditsToDeduct / 1000
  };
}

// Add credits to user (purchase)
async function addCredits(userId, dollarAmount) {
  const creditsToAdd = dollarAmount * 1000; // $1 = 1000 credits
  
  // Record transaction
  await db.query(
    `INSERT INTO credit_transactions 
     (user_id, transaction_type, amount_credits, reason)
     VALUES ($1, $2, $3, $4)`,
    [userId, 'purchase', creditsToAdd, `Purchase: $${dollarAmount}`]
  );
  
  // Update balance
  const result = await db.query(
    `UPDATE user_credit_balance 
     SET total_credits = total_credits + $1,
         remaining_credits = remaining_credits + $1,
         updated_at = NOW()
     WHERE user_id = $2
     RETURNING remaining_credits`,
    [creditsToAdd, userId]
  );
  
  return {
    creditsAdded: creditsToAdd,
    newBalance: result.rows.remaining_credits,
    dollarAmount
  };
}
Frontend: Credit Display
jsx
// components/CreditBalance.jsx

export function CreditBalance({ user }) {
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    const response = await fetch('/api/credits/balance');
    const data = await response.json();
    setBalance(data);
  };

  if (!balance) return <div>Loading...</div>;

  const percentUsed = (balance.used_credits / balance.total_credits) * 100;

  return (
    <div className="credit-balance">
      <h3>Your Credits</h3>
      
      {/* Balance Display */}
      <div className="balance-card">
        <p className="balance-large">
          {balance.remaining_credits.toLocaleString()} / {balance.total_credits.toLocaleString()}
        </p>
        <p className="balance-small">
          ${(balance.remaining_credits / 1000).toFixed(2)} remaining
        </p>
      </div>

      {/* Progress Bar */}
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${percentUsed}%` }}
        />
      </div>

      {/* Usage Text */}
      <p className="usage-text">
        {percentUsed.toFixed(1)}% used ({balance.used_credits.toLocaleString()} credits)
      </p>

      {/* Purchase Button */}
      {balance.remaining_credits < 1000 && (
        <button 
          onClick={() => navigateTo('/pricing')}
          className="btn-purchase"
        >
          Low Credits - Buy More
        </button>
      )}
    </div>
  );
}
Frontend: Pre-Generation Credit Preview
jsx
// components/CreditPreview.jsx

export function CreditPreview({ modelId, estimatedOutputTokens }) {
  const [creditCost, setCreditCost] = useState(null);

  useEffect(() => {
    calculateCredits();
  }, [modelId, estimatedOutputTokens]);

  const calculateCredits = async () => {
    const response = await fetch('/api/credits/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId, outputTokens: estimatedOutputTokens })
    });
    
    const data = await response.json();
    setCreditCost(data);
  };

  if (!creditCost) return null;

  return (
    <div className="credit-preview">
      <h4>Estimated Credit Cost</h4>
      
      <div className="cost-breakdown">
        <p>
          <strong>Model Tier:</strong> {creditCost.tierName}
        </p>
        <p>
          <strong>Output Tokens:</strong> {creditCost.outputTokens.toLocaleString()}
        </p>
        <p>
          <strong>Credits Multiplier:</strong> {creditCost.tierMultiplier}x
        </p>
        <p className="cost-highlight">
          <strong>Total Cost:</strong> {creditCost.creditsNeeded.toLocaleString()} credits
          ({' $'}{creditCost.costEquivalent.toFixed(3)})
        </p>
      </div>

      <p className="cost-note">
        This is an estimate. Actual tokens may vary based on model output.
      </p>
    </div>
  );
}
Part 7: User Documentation
For End Users
How Credits Work
1. What are credits?
Credits are your purchasing power in WriterAI. 1 Credit = 1 Output Token from the AI model.

2. How do I get credits?

$10 = 10,000 credits

$30 = 30,000 credits

$99 = 99,000 credits

3. How many credits does a generation cost?
It depends on:

Model selected (Budget/Standard/Advanced/Frontier)

Output length (how many words/tokens the AI generates)

Example: A 2,000-word blog with GPT-4.1 (Standard model) = ~3,700 credits

4. Why do different models cost different amounts?
Some models are more powerful and expensive to run. You pay for what you use:

Budget models: Cheapest, fast

Standard models: Good balance

Advanced models: Higher quality

Frontier models: Maximum intelligence

5. Can I use my credits on any tool?
Yes! Credits work across all 30+ tools in WriterAI. Use your budget model for quick tasks, premium models for complex ones.

Quick Reference Chart
Model Tier	Output Cost	Example Task	Credit Cost
Budget	1 credit/token	250-word email	~250-500 credits
Standard	2 credits/token	2,000-word blog	~3,000-3,500 credits
Advanced	4 credits/token	2,500-word article	~7,000-8,000 credits
Frontier	8 credits/token	3,000-word analysis	~20,000-24,000 credits
Part 8: Margin Calculation Verification
Cost Structure (70% Margin Model)
User Pays: 1,000 Credits = $1.00

text
Revenue per $1: $1.00 (100%)

COSTS:
├─ LLM API Costs (25%): -$0.25
│  └─ Example: 1,000 output tokens from OpenAI ~$0.20-0.30
├─ Infrastructure (5%): -$0.05
├─ Payment Processing (3%): -$0.03
├─ Support/Operations (8%): -$0.08
└─ Total Direct Costs: -$0.41 (41%)

MARGIN:
└─ Remaining for Profit/Buffer: $0.59 (59%)
Real-World Breakdown (User buys $30):

text
User Pays: $30 (30,000 credits)

Your Costs:
├─ LLM Usage: ~$7.50 (25%)
├─ Infrastructure: ~$1.50 (5%)
├─ Payment Processing: ~$0.90 (3%)
├─ Support/Ops: ~$2.40 (8%)
└─ Total: ~$12.30

Your Margin:
└─ Profit/Buffer: ~$17.70 (59%)
This margin protects against:

Unexpected infrastructure spikes

Customer support time

Payment failures/refunds

Business growth reinvestment

Part 9: Troubleshooting & Edge Cases
What if user runs out of credits mid-generation?
Current generation will fail. User must purchase credits first.

text
Error Message:
"Insufficient credits. You have 500 credits, but this generation requires 3,700 credits. 
Purchase more credits to continue."
What if a generation uses fewer tokens than expected?
User only pays for actual tokens used.

text
Example:
Prompt: "Write a 2,000-word blog"
Estimated: 2,000 words = 1,500 tokens
Actual Output: 1,200 tokens (model was concise)
Charged: 1,200 × 2 = 2,400 credits (not 3,000)
Can users buy a partial credit package?
No. Credit packages are $10, $30, $99 (standard prices). No custom amounts.

This keeps accounting simple and standardizes pricing.

What about refunds?
If generation fails: Credits are refunded.
If user cancels mid-task: Credits are refunded.
If user just wants refund: Not allowed (non-refundable, like digital goods).

Do unused credits expire?
No. Credits never expire. Users can use them anytime (like a gift card).

Summary
WriterAI Credit System:

✅ 4-tier model grouping (Budget/Standard/Advanced/Frontier)

✅ Variable token-based pricing (1 credit = 1 output token)

✅ Three purchase plans ($10, $30, $99)

✅ Fair margin model (59% profit after costs)

✅ Transparent to users (see exact cost before generating)

✅ Scalable system (new models fit automatically)

Last Updated: November 30, 2025
Status: Production Ready
Version: 1.0