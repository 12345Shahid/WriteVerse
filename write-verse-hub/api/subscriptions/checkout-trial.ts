import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { getSupabaseAdmin, getUserIdFromHeader } from '../supabaseAdmin.js';

const TRIAL_DAYS = 7;
const TRIAL_CREDITS = 7000;

// Plan details with proper formatting for Stripe checkout display
const PLAN_DETAILS = {
  starter: {
    name: 'Starter Plan',
    monthlyPrice: 100, // $1.00 for testing
    yearlyPrice: 1000, // $10.00/year for testing
    credits: 30000,
    description: 'All 25+ writing tools • 30,000 credits/month • 1-2 custom agents • Basic knowledge base (100MB) • Basic workflows (3-5 steps) • 1 brand voice profile • Basic analytics (30 days)'
  },
  professional: {
    name: 'Professional Plan',
    monthlyPrice: 7900, // $79.00
    yearlyPrice: 75800, // $758/year
    credits: 100000,
    description: 'Everything in Starter • 100,000 credits/month • 5 custom agents • Advanced knowledge base (500MB) • Advanced workflows (10+ steps) • 5 brand voice profiles • Advanced analytics (90 days)'
  },
  business: {
    name: 'Business Plan',
    monthlyPrice: 19900, // $199.00
    yearlyPrice: 191000, // $1,910/year
    credits: 300000,
    description: 'Everything in Professional • 300,000 credits/month • Unlimited agents • Enterprise knowledge base (2GB) • Unlimited workflows • 20 brand voice profiles • Full analytics (365 days)'
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' as any });
  const supabaseAdmin = getSupabaseAdmin();
  
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const userId = getUserIdFromHeader(req);
  const { organizationId, plan, billing = 'monthly', successUrl, cancelUrl } = req.body;

  if (!organizationId || !plan) {
    return res.status(400).json({ error: 'organizationId and plan required' });
  }

  if (!['starter', 'professional', 'business'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  const planDetails = PLAN_DETAILS[plan as keyof typeof PLAN_DETAILS];

  try {
    // Check if subscription already exists
    const { data: existing } = await supabaseAdmin
      .from('organization_subscriptions')
      .select('id, status, stripe_customer_id')
      .eq('organization_id', organizationId)
      .single();

    if (existing && existing.status !== 'expired' && existing.status !== 'canceled' && existing.status !== 'trialing') {
      return res.status(400).json({ 
        error: 'Active subscription already exists',
        existingStatus: existing.status
      });
    }

    // If upgrading from trial, don't apply trial period
    const isUpgradeFromTrial = existing?.status === 'trialing';

    // Get user email for Stripe
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId || '');
    const customerEmail = userData?.user?.email;

    // Create or get Stripe customer
    let customerId = existing?.stripe_customer_id;
    
    if (!customerId && customerEmail) {
      const customer = await stripe.customers.create({
        email: customerEmail,
        metadata: {
          organization_id: organizationId,
          user_id: userId || ''
        }
      });
      customerId = customer.id;
    }

    // Determine price based on billing cycle
    const unitAmount = billing === 'yearly' ? planDetails.yearlyPrice : planDetails.monthlyPrice;
    const interval = billing === 'yearly' ? 'year' : 'month';

    // Create Stripe Checkout Session with trial using price_data
    const session = await stripe.checkout.sessions.create({
      customer: customerId || undefined,
      customer_email: customerId ? undefined : customerEmail,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: planDetails.name,
              description: planDetails.description,
            },
            unit_amount: unitAmount,
            recurring: {
              interval: interval as 'month' | 'year',
            },
          },
          quantity: 1,
        }
      ],
      mode: 'subscription',
      subscription_data: {
        // Skip trial if upgrading from an existing trial
        ...(isUpgradeFromTrial ? {} : { trial_period_days: TRIAL_DAYS }),
        metadata: {
          organization_id: organizationId,
          plan: plan,
          trial_credits: TRIAL_CREDITS.toString(),
          upgraded_from_trial: isUpgradeFromTrial ? 'true' : 'false'
        }
      },
      success_url: successUrl || `${process.env.VITE_APP_URL || 'https://writerai.app'}/subscription?success=true`,
      cancel_url: cancelUrl || `${process.env.VITE_APP_URL || 'https://writerai.app'}/subscription/pricing?canceled=true`,
      metadata: {
        organization_id: organizationId,
        plan: plan,
        user_id: userId || ''
      }
    });

    console.log('[API][checkout-trial] Session created:', {
      sessionId: session.id,
      organizationId,
      plan,
      trialDays: TRIAL_DAYS
    });

    return res.json({
      sessionId: session.id,
      url: session.url
    });
  } catch (err: any) {
    console.error('[API][checkout-trial] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
