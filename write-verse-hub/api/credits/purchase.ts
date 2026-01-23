import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { getSupabaseAdmin, getUserIdFromHeader } from '../supabaseAdmin.js';

// Credits package pricing
const CREDIT_PACKAGES = {
  small: { credits: 5000, price_cents: 500, name: '5,000 Credits' },
  medium: { credits: 20000, price_cents: 2000, name: '20,000 Credits' },
  large: { credits: 50000, price_cents: 5000, name: '50,000 Credits' },
  custom: { credits_per_dollar: 1000, name: 'Custom Amount' }
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
  const { organizationId, package: creditPackage, customAmount, successUrl, cancelUrl } = req.body;

  if (!organizationId) {
    return res.status(400).json({ error: 'organizationId required' });
  }

  try {
    // Get user email for Stripe
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId || '');
    const customerEmail = userData?.user?.email;

    // Get or create Stripe customer
    const { data: subscription } = await supabaseAdmin
      .from('organization_subscriptions')
      .select('stripe_customer_id')
      .eq('organization_id', organizationId)
      .single();

    let customerId = subscription?.stripe_customer_id;

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

    // Calculate credits and price
    let credits: number;
    let priceCents: number;
    let packageName: string;

    if (creditPackage && CREDIT_PACKAGES[creditPackage as keyof typeof CREDIT_PACKAGES]) {
      const pkg = CREDIT_PACKAGES[creditPackage as keyof typeof CREDIT_PACKAGES];
      if ('credits' in pkg) {
        credits = pkg.credits;
        priceCents = pkg.price_cents;
        packageName = pkg.name;
      } else {
        // Custom amount
        const amount = Math.max(1, Math.min(1000, customAmount || 10)); // $1 - $1000
        credits = amount * pkg.credits_per_dollar;
        priceCents = amount * 100;
        packageName = `${credits.toLocaleString()} Credits`;
      }
    } else {
      return res.status(400).json({ error: 'Invalid credit package' });
    }

    // Create Stripe Checkout Session for one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId || undefined,
      customer_email: customerId ? undefined : customerEmail,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: packageName,
              description: `${credits.toLocaleString()} credits for WriterAI`,
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl || `${process.env.VITE_APP_URL || 'https://writerai.app'}/subscription?credits_purchased=true`,
      cancel_url: cancelUrl || `${process.env.VITE_APP_URL || 'https://writerai.app'}/subscription?credits_canceled=true`,
      metadata: {
        organization_id: organizationId,
        credits: credits.toString(),
        user_id: userId || '',
        type: 'credit_purchase'
      }
    });

    console.log('[API][purchase-credits] Session created:', {
      sessionId: session.id,
      organizationId,
      credits,
      priceCents
    });

    return res.json({
      sessionId: session.id,
      url: session.url,
      credits,
      priceCents
    });
  } catch (err: any) {
    console.error('[API][purchase-credits] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
