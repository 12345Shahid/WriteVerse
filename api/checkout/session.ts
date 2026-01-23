// @ts-nocheck
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' }) : null;
const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  const userId = (req.headers['x-user-id'] || req.headers['X-User-Id']) as string | undefined;
  if (!userId) return res.status(401).json({ error: 'NO_USER_ID' });

  const amountUsd = Number(req.body?.amountUsd);
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return res.status(400).json({ error: 'INVALID_REQUEST', message: 'amountUsd must be a positive number' });
  }

  if (!stripe) {
    return res.status(500).json({ error: 'STRIPE_NOT_CONFIGURED', message: 'Checkout not available. Ensure Stripe is configured.' });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  }

  try {
    const host = req.headers['x-forwarded-host'] || req.headers['host'];
    const proto = (req.headers['x-forwarded-proto'] || 'https') as string;
    const baseUrl = host ? `${proto}://${host}` : (process.env.PUBLIC_URL || 'https://example.com');

    const credits = Math.floor(amountUsd * 100); // 1 USD -> 100 credits

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      metadata: {
        userId,
        credits: String(credits),
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `WriterAI Credits - ${credits} credits`,
              description: `${credits} generation credits`,
            },
            unit_amount: Math.round(amountUsd * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard?checkout=cancelled`,
    });

    // Log pending transaction (optional; requires SQL from till.sql)
    try {
      await supabaseAdmin
        .from('credits_transactions')
        .insert({ user_id: userId, amount_cents: Math.round(amountUsd * 100), credits_added: credits, status: 'pending', stripe_session_id: session.id });
    } catch (e) {
      // swallow insert errors, not fatal for checkout
    }

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error('[Checkout] Error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err?.message || err) });
  }
}
